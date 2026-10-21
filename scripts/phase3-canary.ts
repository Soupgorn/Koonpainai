// Synthetic fixtures only. This helper cannot target a production endpoint.
// No environment loading, password generation or credential provisioning.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { createMemberRepository } from "../src/db/member-repository";
import { KMITL_ISSUER, POLICY_VERSION, memberGate } from "../src/lib/auth/domain";
import { oidcFixture } from "../tests/fixtures/auth-fixtures";

export const ISOLATED_MARKER = "koonpinai-phase3-synthetic-only";
export function assertLocalCanaryTarget(host: unknown, port: unknown, database: unknown) {
  assert.ok(host === "127.0.0.1", "ISOLATED_LOOPBACK_REQUIRED");
  assert.ok(Number.isInteger(port) && Number(port) >= 55434 && Number(port) <= 55534, "ISOLATED_PORT_REQUIRED");
  assert.equal(database, "phase3_synthetic", "ISOLATED_DATABASE_REQUIRED");
}

export async function runIsolatedCanary(owner: Pool, initialRuntime: Pool, root: string, reconnectRuntime: () => Pool) {
  for (const p of [owner, initialRuntime]) assertLocalCanaryTarget(p.options.host, p.options.port, p.options.database);
  assert.equal(readFileSync(resolve(root, "created-for-isolated-verification.marker"), "utf8"), ISOLATED_MARKER);
  assert.equal(resolve((await owner.query("SHOW data_directory")).rows[0].data_directory), resolve(root, "data"));
  assert.equal((await initialRuntime.query("SELECT current_user AS role")).rows[0].role, "koonpinai_runtime");
  const checked: string[] = [];
  const check = (name: string) => checked.push(name);
  const subject = "fictional-oidc-subject";
  const adminSubject = "phase3-fixture-admin-" + randomUUID();
  const controlSubject = "phase3-untouched-control-" + randomUUID();
  // Abort on a pre-existing identity; never adopt it as a disposable fixture.
  assert.equal((await owner.query("SELECT count(*)::int AS n FROM public.members WHERE oidc_issuer=$1 AND oidc_subject=$2", [KMITL_ISSUER, subject])).rows[0].n, 0);
  assert.equal((await owner.query("SELECT count(*)::int AS n FROM public.members")).rows[0].n, 0);
  let runtime = initialRuntime;
  let repo = createMemberRepository(drizzle(runtime));
  let controlId: string | undefined;
  let controlDigest: string | undefined;
  const fixtureIds = new Set<string>();
  const failures: string[] = [];
  async function expectDenied(sql: string, values: unknown[] = []) {
    await assert.rejects(runtime.query(sql, values), (e: unknown) => (e as { code?: string }).code === "42501");
  }
  async function cleanFixtures() {
    const c = await owner.connect();
    try {
      await c.query("BEGIN; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='10s'");
      const rows = (await c.query("SELECT id,oidc_subject FROM public.members WHERE oidc_issuer=$1 AND oidc_subject=ANY($2::text[]) FOR UPDATE", [KMITL_ISSUER, [subject, adminSubject]])).rows;
      assert.equal(rows.length, fixtureIds.size);
      assert.ok(rows.every(r => fixtureIds.has(r.id)));
      // Explicit session scope, then identities. No TRUNCATE or broad predicate.
      const sessions = await c.query("DELETE FROM public.application_sessions WHERE member_id=ANY($1::uuid[])", [[...fixtureIds]]);
      const members = await c.query("DELETE FROM public.members WHERE id=ANY($1::uuid[]) AND oidc_issuer=$2 AND oidc_subject=ANY($3::text[])", [[...fixtureIds], KMITL_ISSUER, [subject, adminSubject]]);
      assert.equal(members.rowCount, fixtureIds.size);
      const control = await c.query("SELECT md5(to_jsonb(t)::text) AS digest FROM public.members t WHERE id=$1", [controlId]);
      assert.equal(control.rows[0]?.digest, controlDigest);
      await c.query("COMMIT");
      return { membersRemoved: members.rowCount, sessionsRemoved: sessions.rowCount, controlUnchanged: true };
    } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
  }
  try {
    controlId = (await owner.query("INSERT INTO public.members(oidc_issuer,oidc_subject,display_name) VALUES($1,$2,'Synthetic untouched control') RETURNING id", ["https://fixture.invalid", controlSubject])).rows[0].id;
    controlDigest = (await owner.query("SELECT md5(to_jsonb(t)::text) AS digest FROM public.members t WHERE id=$1", [controlId])).rows[0].digest;
    const f = await oidcFixture();
    for (const name of ["login", "activeSession", "revokeSession", "find", "saveProfile", "acknowledgePolicy", "list", "setStatus"] as const) {
      // Auth.js captures this object; each method follows only the explicit pool switch.
      Object.assign(f.repository, { [name]: (...args: unknown[]) => Reflect.apply(repo[name], repo, args) });
    }
    await f.begin(); const callback = await f.callback();
    assert.equal(callback.status, 302); assert.ok(f.pkceChecked());
    let session = await (await f.request("/session")).json();
    assert.ok(session.user?.id);
    const memberId = session.user.id as string; fixtureIds.add(memberId);
    let member = await repo.find(memberId); assert.ok(member);
    assert.equal(member.role, "member"); assert.equal(member.status, "pending"); assert.equal(memberGate(member), "profile");
    check("Auth.js code flow + PKCE + encrypted session with real restricted Drizzle writes (OIDC mocked)");
    await repo.saveProfile(memberId, { nickname: "Canary", thaiName: "ทดสอบ", department: "Synthetic programme" });
    member = await repo.find(memberId); assert.equal(memberGate(member!), "policy");
    await repo.acknowledgePolicy(memberId, "2026-10-21");
    member = await repo.find(memberId); assert.equal(memberGate(member!), "policy");
    await repo.acknowledgePolicy(memberId, POLICY_VERSION);
    member = await repo.find(memberId); assert.equal(memberGate(member!), "pending");
    check("Profile + Thai text + old policy rejected + explicit renewed acknowledgement");
    const admin = (await owner.query("INSERT INTO public.members(oidc_issuer,oidc_subject,display_name,nickname,department,profile_completed_at,policy_version,policy_accepted_at,status,role) VALUES($1,$2,'Synthetic admin','Fixture admin','Synthetic',now(),$3,now(),'approved','admin') RETURNING id", [KMITL_ISSUER, adminSubject, POLICY_VERSION])).rows[0]; fixtureIds.add(admin.id);
    await assert.rejects(repo.setStatus(memberId, admin.id, "suspended"));
    await assert.rejects(repo.setStatus(admin.id, admin.id, "suspended"));
    await repo.setStatus(admin.id, memberId, "approved");
    assert.equal(memberGate((await repo.find(memberId))!), "allowed");
    await repo.setStatus(admin.id, memberId, "suspended");
    assert.equal(memberGate((await repo.find(memberId))!), "suspended");
    await repo.setStatus(admin.id, memberId, "pending");
    await repo.setStatus(admin.id, memberId, "approved");
    assert.equal((await repo.list()).length, 3);
    check("Admin approve/suspend/pending/restore, row locks, ordinary and self changes denied");
    // Repeat validated login updates one identity and adds a session, never a role.
    await f.begin(); await f.callback();
    session = await (await f.request("/session")).json(); assert.equal(session.user.id, memberId);
    assert.equal((await owner.query("SELECT count(*)::int AS n FROM public.members WHERE oidc_issuer=$1 AND oidc_subject=$2", [KMITL_ISSUER, subject])).rows[0].n, 1);
    check("Repeat login upsert preserves identity/status/role");
    await expectDenied("UPDATE public.members SET role='admin' WHERE id=$1", [memberId]);
    await expectDenied("DELETE FROM public.members WHERE id=$1", [memberId]);
    await expectDenied("TRUNCATE public.application_sessions");
    await expectDenied("INSERT INTO public.members(oidc_issuer,oidc_subject,display_name,role,status) VALUES('https://fixture.invalid','denied-admin','Denied','admin','approved')");
    check("Runtime cannot elevate role, delete, truncate or insert an approved administrator");
    // Prove a failed transaction restores only the synthetic profile.
    const before = (await repo.find(memberId))!.nickname;
    const tx = await runtime.connect();
    try { await tx.query("BEGIN"); await tx.query("UPDATE public.members SET nickname='Must roll back' WHERE id=$1", [memberId]); await assert.rejects(tx.query("UPDATE public.members SET role='admin' WHERE id=$1", [memberId])); await tx.query("ROLLBACK"); } finally { tx.release(); }
    assert.equal((await repo.find(memberId))!.nickname, before);
    check("Permission failure transaction rollback leaves fixture unchanged");
    // Drain a checked-out connection before the explicit role/configuration switch.
    const held = await runtime.connect(); let ended = false;
    const draining = runtime.end().then(() => { ended = true; });
    await new Promise(r => setTimeout(r, 30)); assert.equal(ended, false);
    await held.query("SELECT 1"); held.release(); await draining; assert.equal(ended, true);
    await assert.rejects(runtime.query("SELECT 1")); // fail closed; no automatic fallback
    repo = createMemberRepository(drizzle(owner));
    session = await (await f.request("/session")).json(); assert.equal(session.user.id, memberId);
    assert.equal((await owner.query("SELECT current_user AS role")).rows[0].role, "postgres");
    await repo.saveProfile(memberId, { nickname: "Rollback canary", thaiName: "ทดสอบ", department: "Synthetic programme" });
    check("Explicit postgres rollback after pool drain; encrypted JWT/session preserved; no grant changes");
    runtime = reconnectRuntime(); assertLocalCanaryTarget(runtime.options.host, runtime.options.port, runtime.options.database);
    assert.equal((await runtime.query("SELECT current_user AS role")).rows[0].role, "koonpinai_runtime");
    repo = createMemberRepository(drizzle(runtime));
    session = await (await f.request("/session")).json(); assert.equal(session.user.id, memberId);
    check("Fresh restricted reconnect after explicit rollback");
    const csrf = await (await f.request("/csrf")).json();
    await f.request("/signout", "POST", new URLSearchParams({ csrfToken: csrf.csrfToken, callbackUrl: f.settings.origin }));
    assert.deepEqual(await (await f.request("/session")).json(), null);
    assert.equal((await owner.query("SELECT count(*)::int AS n FROM public.application_sessions WHERE member_id=$1 AND revoked_at IS NOT NULL", [memberId])).rows[0].n, 1);
    const expired = randomUUID();
    await repo.login({ issuer: KMITL_ISSUER, subject, displayName: "Synthetic", email: null }, expired, new Date(Date.now() - 1000));
    assert.equal(await repo.activeSession(expired), null);
    check("Local Auth.js logout revokes session; expired session rejected");
  } catch (e) { failures.push("CANARY_ASSERTION_FAILED"); throw e; }
  finally {
    await runtime.end().catch(() => {});
    // On an assertion failure, preserve the stopped synthetic cluster for diagnosis.
    if (failures.length === 0) {
      fixtureIds.add(controlId!);
      await assert.rejects(cleanFixtures());
      fixtureIds.delete(controlId!);
      check("Tampered cleanup identity allowlist fails before any deletion");
      const cleanup = await cleanFixtures();
      await assert.rejects(cleanFixtures());
      assert.equal((await owner.query("SELECT count(*)::int AS n FROM public.application_sessions")).rows[0].n, 0);
      assert.equal((await owner.query("SELECT count(*)::int AS n FROM public.members")).rows[0].n, 1);
      check(`Exact cleanup: ${cleanup.membersRemoved} fixture members and ${cleanup.sessionsRemoved} sessions removed; control preserved`);
      check("Repeated cleanup fails closed rather than broadening its target");
    }
  }
  return { status: "PASS", checks: checked, checkCount: checked.length, realOidc: false, realApplicationRepository: true, realRestrictedPostgres: true, productionConnected: false };
}
