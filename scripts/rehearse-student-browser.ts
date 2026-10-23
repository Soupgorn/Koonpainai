// Real Next Server Actions + restricted PostgreSQL, synthetic identities only.
// HTTPS app.example is intercepted in-process; no university/network login.
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { request } from "node:http";
import { chromium, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import type { Pool } from "pg";
import { POLICY_VERSION } from "../src/lib/auth/domain";
import { assertLocalCanaryTarget, ISOLATED_MARKER } from "./phase3-canary";
import { osEnvironment } from "../runtime/secrets.mjs";

export async function rehearseStudentBrowser(o: { owner: Pool; root: string; artifact: string; secretRoot: string; url: string; caFile: string; selfHosted?: boolean }) {
  assertLocalCanaryTarget(o.owner.options.host, o.owner.options.port, o.owner.options.database);
  assert.equal(readFileSync(join(o.root, "created-for-isolated-verification.marker"), "utf8"), ISOLATED_MARKER);
  assert.equal(resolve((await o.owner.query("SHOW data_directory")).rows[0].data_directory), resolve(o.root, "data"));
  const target = new URL(o.url); assert.equal(target.hostname, "127.0.0.1"); assert.equal(target.username, "koonpinai_runtime");
  const ids = [randomUUID(), randomUUID(), randomUUID()], sids = ids.map(() => randomUUID()), subjects = ids.map(() => "browser-fixture-" + randomUUID());
  const secret = "PUBLIC-fictional-browser-auth-secret-".repeat(3);
  for (const [name, value] of [["database", o.url], ["auth", secret], ["oidc", "PUBLIC-fictional-browser-client"], ["ca.crt", readFileSync(o.caFile, "utf8")]]) writeFileSync(join(o.secretRoot, name), value, { flag: "wx", mode: 0o600 });
  const manifest = { version: 1, artifactSha256: createHash("sha256").update(readFileSync(join(o.artifact, "runtime-artifact.json"))).digest("hex"), authUrl: "https://app.example/", clientId: "fixture-client", database: { file: join(o.secretRoot, "database"), format: "text" }, ...(o.selfHosted ? {databaseEndpoint:{kind:'self-hosted',host:target.hostname,port:Number(target.port),database:target.pathname.slice(1)}} : {}), authSecret: { file: join(o.secretRoot, "auth"), format: "text" }, clientSecret: { file: join(o.secretRoot, "oidc"), format: "text" }, caFile: join(o.secretRoot, "ca.crt"), port: 3340, healthPort: 3341, host: "127.0.0.1", shutdownMs: 30000 };
  const mf = join(o.secretRoot, "manifest.json"); writeFileSync(mf, JSON.stringify(manifest), { flag: "wx", mode: 0o600 });
  const helper = join(o.root, "fixture-browser-supervisor.mjs");
  writeFileSync(helper, `import {supervise} from ${JSON.stringify(pathToFileURL(join(o.artifact, "runtime/supervise.mjs")).href)};import {loadRuntimeEnvironment,assertRuntimeSecretDirectory} from ${JSON.stringify(pathToFileURL(join(o.artifact, "runtime/secrets.mjs")).href)};assertRuntimeSecretDirectory(${JSON.stringify(mf)});supervise(${JSON.stringify(o.artifact)},loadRuntimeEnvironment(${JSON.stringify(mf)},${JSON.stringify(o.artifact)},{isolated:true}));`, { flag: "wx" });
  const before = (await o.owner.query("SELECT md5(coalesce(jsonb_agg(to_jsonb(m) order by id)::text,'[]')) digest FROM public.members m")).rows[0].digest;
  for (let i = 0; i < ids.length; i++) {
    await o.owner.query("INSERT INTO public.members(id,oidc_issuer,oidc_subject,display_name,nickname,department,profile_completed_at,policy_version,policy_accepted_at,status) VALUES($1,'https://sso.kmitl.ac.th/realms/kmitl',$2,'Synthetic browser',$3,'Synthetic',now(),$4,now(),$5)", [ids[i], subjects[i], ["Browser A", "Browser B", "Pending fixture"][i], POLICY_VERSION, i === 2 ? "pending" : "approved"]);
    await o.owner.query("INSERT INTO public.application_sessions(id,member_id,expires_at) VALUES($1,$2,now()+interval '1 hour')", [sids[i], ids[i]]);
  }
  const child = spawn(process.execPath, o.selfHosted ? [join(o.artifact,"runtime/launch.mjs"),mf] : [helper], { cwd: o.artifact, env: { ...osEnvironment(), NODE_ENV: "production" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"] });
  let logs = ""; for (const stream of [child.stdout, child.stderr]) stream?.on("data", b => { logs += b.toString(); });
  const exit = new Promise<number | null>(ok => child.once("exit", ok));
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const checks: string[] = [];
  try {
    await new Promise<void>((ok, fail) => { const t = setTimeout(() => fail(Error("ISOLATED_START_TIMEOUT")), 45000); child.on("message", m => { if ((m as { event?: string }).event === "ready") { clearTimeout(t); ok(); } }); child.once("exit", () => { clearTimeout(t); fail(Error("ISOLATED_START_FAILED")); }); });
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    // Controlled reverse proxy for this fixture only. Preserve actual origin,
    // Host and Server Action POST body; never contact app.example or KMITL.
    await context.route("**/*", async route => {
      const r = route.request(), u = new URL(r.url());
      if (u.origin !== "https://app.example") { await route.abort(); return; }
      const headers = { ...r.headers(), host: "app.example", "x-forwarded-proto": "https", "accept-encoding": "identity" };
      const result = await new Promise<{ status: number; headers: Record<string, string>; body: Buffer }>((ok, fail) => {
        const req = request({ hostname: "127.0.0.1", port: 3340, path: u.pathname + u.search, method: r.method(), headers }, res => {
          const parts: Buffer[] = []; res.on("data", b => parts.push(b)); res.on("end", () => { const h: Record<string, string> = {}; for (const [k, v] of Object.entries(res.headers)) if (v !== undefined && k !== "transfer-encoding" && k !== "content-length") h[k] = Array.isArray(v) ? v.join("\n") : v; ok({ status: res.statusCode!, headers: h, body: Buffer.concat(parts) }); });
        }); req.on("error", fail); req.setTimeout(20000, () => req.destroy(Error("ISOLATED_HTTP_TIMEOUT"))); req.end(r.postDataBuffer());
      });
      await route.fulfill(result);
    });
    const signAs = async (i: number) => {
      await context.clearCookies();
      const token = await encode({ secret, salt: "__Secure-authjs.session-token", token: { sub: ids[i], userId: ids[i], sid: sids[i], oidcIssuer: "https://sso.kmitl.ac.th/realms/kmitl", oidcSubject: subjects[i], deadline: Math.floor(Date.now() / 1000) + 3600 }, maxAge: 3600 });
      await context.addCookies([{ name: "__Secure-authjs.session-token", value: token, domain: "app.example", path: "/", secure: true, httpOnly: true, sameSite: "Lax" }]);
    };
    const page = await context.newPage(); await signAs(0);
    await page.goto("https://app.example/my-timetable");
    await page.getByRole("button", { name: "Set semester" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Semester name").fill("Semester 1 / 2569"); await dialog.getByLabel("Start date").fill("2026-08-01"); await dialog.getByLabel("End date").fill("2026-12-31"); await dialog.getByRole("button", { name: "Save semester" }).click(); await expect(dialog).not.toBeVisible();
    assert.equal((await o.owner.query("SELECT count(*)::int n FROM public.student_timetables WHERE member_id=$1", [ids[0]])).rows[0].n, 1);
    await page.getByRole("button", { name: "Add class", exact: true }).click(); dialog = page.getByRole("dialog");
    await dialog.getByLabel("Course name", { exact: true }).fill("Persisted seminar"); await dialog.getByLabel("Weekday").selectOption("5"); await dialog.getByLabel("Start time").fill("08:45"); await dialog.getByLabel("End time").fill("10:15"); await dialog.getByRole("button", { name: "Add class", exact: true }).click(); await expect(dialog).not.toBeVisible();
    await page.reload(); await expect(page.locator(".timetable-event").filter({ hasText: "Persisted seminar" })).toBeVisible();
    assert.equal((await o.owner.query("SELECT start_time::text AS start FROM public.timetable_entries WHERE member_id=$1", [ids[0]])).rows[0].start, "08:45:00");
    await page.locator(".timetable-event").filter({ hasText: "Persisted seminar" }).click(); dialog = page.getByRole("dialog"); await dialog.getByLabel("Classroom / location").fill("E-204"); await dialog.getByRole("button", { name: "Save changes" }).click(); await expect(dialog).not.toBeVisible(); await page.reload();
    await expect(page.locator(".timetable-event").filter({ hasText: "Persisted seminar" })).toContainText("E-204");
    checks.push("Actual built Next Server Actions persist own semester/add/edit through restricted Drizzle and survive reload");
    await signAs(1); await page.goto(`https://app.example/friends/${ids[0]}`);
    await expect(page.getByRole("heading", { name: "Browser A", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add class", exact: true })).toHaveCount(0); await expect(page.locator(".timetable-event").filter({ hasText: "Persisted seminar" })).toBeVisible();
    await page.goto(`https://app.example/friends/${ids[2]}`); await expect(page.getByRole("heading", { name: "A little off the timetable." })).toBeVisible();
    await signAs(2); await page.goto("https://app.example/my-timetable"); await expect(page.getByRole("button", { name: "Set semester" })).toBeVisible(); await page.goto("https://app.example/"); await expect(page).toHaveURL(/pending-approval/);
    checks.push("Authenticated peer can view but has no editor; pending profile hidden and pending dashboard denied while own setup allowed");
    await signAs(0); await page.goto("https://app.example/my-timetable"); await page.locator(".timetable-event").filter({ hasText: "Persisted seminar" }).click(); await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click(); await page.getByRole("button", { name: "Delete class", exact: true }).click(); await expect(page.getByRole("dialog")).not.toBeVisible(); await page.reload();
    assert.equal((await o.owner.query("SELECT count(*)::int n FROM public.timetable_entries WHERE member_id=$1", [ids[0]])).rows[0].n, 0);
    checks.push("Confirmed delete executes real owner-scoped Server Action and remains deleted after reload");
    await o.owner.query("UPDATE public.application_sessions SET revoked_at=now() WHERE id=$1", [sids[0]]); await page.goto("https://app.example/my-timetable"); await expect(page).toHaveURL(/login/);
    checks.push("Revoked synthetic Auth.js session cannot reopen the editor");
  } finally {
    await browser?.close();
    if (child.exitCode === null && child.connected) child.send({ type: "shutdown" });
    let t: ReturnType<typeof setTimeout> | undefined; try { assert.equal(await Promise.race([exit, new Promise((_, fail) => { t = setTimeout(() => fail(Error("ISOLATED_DRAIN_TIMEOUT")), 35000); })]), 0); } finally { clearTimeout(t); }
    assert.ok(!logs.includes(o.url) && !logs.includes(secret), "ISOLATED_SECRET_LOGGING");
    assert.equal((await o.owner.query("SELECT count(*)::int n FROM pg_stat_activity WHERE usename='koonpinai_runtime' AND datname=current_database()")).rows[0].n, 0);
    assert.equal((await o.owner.query("SELECT count(*)::int n FROM public.members WHERE id=ANY($1::uuid[]) AND oidc_subject=ANY($2::text[])", [ids, subjects])).rows[0].n, ids.length);
    await o.owner.query("DELETE FROM public.application_sessions WHERE id=ANY($1::uuid[]) AND member_id=ANY($2::uuid[])", [sids, ids]);
    await o.owner.query("DELETE FROM public.members WHERE id=ANY($1::uuid[]) AND oidc_subject=ANY($2::text[])", [ids, subjects]);
    assert.equal((await o.owner.query("SELECT md5(coalesce(jsonb_agg(to_jsonb(m) order by id)::text,'[]')) digest FROM public.members m")).rows[0].digest, before);
  }
  return { status: "PASS", checks, count: checks.length, realNext: true, realServerActions: true, realRestrictedPostgres: true, realOidc: false, syntheticSession: true, productionConnected: false, productionLauncher: o.selfHosted??false, fixturesCleaned: true, runtimeDrained: true };
}
