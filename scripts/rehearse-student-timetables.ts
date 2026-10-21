// Synthetic loopback testing only; never loads dotenv or hosted credentials.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { createTimetableRepository } from "../src/db/timetable-repository";
import { executeReviewedMigrations, migrationFiles, readLedger } from "../src/db/migrations";
import { POLICY_VERSION } from "../src/lib/auth/domain";
import { assertLocalCanaryTarget, ISOLATED_MARKER } from "./phase3-canary";
import { getAvailability, placeOverlaps } from "../src/lib/schedule";

export async function rehearseStudentTimetables(owner: Pool, runtime: Pool, root: string) {
  for (const p of [owner, runtime]) assertLocalCanaryTarget(p.options.host, p.options.port, p.options.database);
  assert.equal(readFileSync(resolve(root, "created-for-isolated-verification.marker"), "utf8"), ISOLATED_MARKER);
  assert.equal(resolve((await owner.query("SHOW data_directory")).rows[0].data_directory), resolve(root, "data"));
  assert.equal((await runtime.query("select current_user as role")).rows[0].role, "koonpinai_runtime");
  const checks: string[] = [];
  const files = migrationFiles();
  const migration = files[2];
  assert.equal(files.length, 3);
  const accountState = async () => (await owner.query("select md5(coalesce(jsonb_agg(to_jsonb(m) order by id)::text,'[]')) as digest from public.members m")).rows[0].digest;
  const original = await accountState();
  const c = await owner.connect();
  try {
    assert.equal((await readLedger(c)).length, 2);
    await c.query("BEGIN");
    for (const statement of migration.sql) if (statement.trim()) await c.query(statement);
    await c.query("ROLLBACK");
    assert.equal((await c.query("select to_regclass('public.student_timetables') is null as absent")).rows[0].absent, true);
    assert.equal((await readLedger(c)).length, 2);
    checks.push("Exact replacement migration rolls back atomically without ledger or account changes");
    await c.query("BEGIN; CREATE TABLE public.application_settings (marker text)");
    await assert.rejects(c.query(migration.sql[0]));
    await c.query("ROLLBACK");
    checks.push("Retired API object precondition mismatch fails before replacement DDL");
    assert.equal(await executeReviewedMigrations(c, "0002"), 1);
    assert.equal(await executeReviewedMigrations(c, "0002"), 0);
    const ledger = await readLedger(c);
    assert.equal(ledger.length, 3); assert.equal(ledger[2].hash, migration.hash);
    assert.equal(await accountState(), original);
    checks.push("Reviewed runner applies only new 0002 and is idempotent with exact ledger checksum");
  } finally { c.release(); }

  const security = (await owner.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid IN ('public.student_timetables'::regclass,'public.timetable_entries'::regclass)")).rows;
  assert.ok(security.length === 2 && security.every(r => r.relrowsecurity && r.relforcerowsecurity));
  const unsafe = await owner.query("SELECT count(*)::int n FROM pg_roles r CROSS JOIN (VALUES('public.student_timetables'),('public.timetable_entries')) t(name) WHERE r.rolname IN ('anon','authenticated') AND (has_table_privilege(r.oid,t.name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') OR has_any_column_privilege(r.oid,t.name,'SELECT,INSERT,UPDATE,REFERENCES'))");
  assert.equal(unsafe.rows[0].n, 0);
  assert.equal((await owner.query("select has_table_privilege('koonpinai_runtime','public.timetable_entries','TRUNCATE,TRIGGER,REFERENCES') unsafe,has_column_privilege('koonpinai_runtime','public.timetable_entries','member_id','UPDATE') move,has_table_privilege('koonpinai_runtime','public.student_timetables','DELETE') delete_term")).rows[0].unsafe, false);
  assert.equal((await owner.query("select has_column_privilege('koonpinai_runtime','public.timetable_entries','member_id','UPDATE') move")).rows[0].move, false);
  checks.push("New-table RLS forced; PUBLIC/client ACLs removed; runtime cannot reassign owners or truncate");

  const ids: string[] = Array.from({ length: 6 }, () => randomUUID());
  const subjects = ids.map((_, i) => `student-timetable-fixture-${i}-${randomUUID()}`);
  const beforeRecords = await accountState();
  try {
    for (let i = 0; i < ids.length; i++) await owner.query("INSERT INTO public.members(id,oidc_issuer,oidc_subject,display_name,nickname,department,profile_completed_at,policy_version,policy_accepted_at,status,role) VALUES($1,'https://sso.kmitl.ac.th/realms/kmitl',$2,'Synthetic student','Fixture','Synthetic',now(),$3,now(),$4,$5)", [ids[i], subjects[i], i === 4 ? "2026-10-21-api-v2" : POLICY_VERSION, i === 3 ? "pending" : i === 5 ? "suspended" : "approved", i === 2 ? "admin" : "member"]);
    const repo = createTimetableRepository(drizzle(runtime));
    const term = { name: "Semester 1 / 2569", start: "2026-08-01", end: "2026-12-31", revision: 0 };
    let a = await repo.saveTerm(ids[0], term);
    const b = await repo.saveTerm(ids[1], term);
    await repo.saveTerm(ids[2], term); await repo.saveTerm(ids[3], term);
    const entry = { name: "พีชคณิตเชิงเส้น", code: "", section: "", room: "", day: 5, start: "08:45", end: "10:15", revision: a.revision };
    a = await repo.saveEntry(ids[0], entry);
    const first = a.sessions[0];
    a = await repo.saveEntry(ids[0], { ...entry, start: "10:30", end: "12:00", revision: a.revision });
    a = await repo.saveEntry(ids[0], { ...entry, name: "Networks", day: 4, start: "13:00", end: "16:00", revision: a.revision, room: "E-204" });
    assert.equal(a.sessions.find(s => s.start === "08:45")?.end, "10:15");
    assert.equal(a.sessions.find(s => s.start === "10:30")?.end, "12:00");
    assert.equal((await repo.getOwn(ids[0]))?.sessions.find(s => s.name === "Networks")?.room, "E-204");
    checks.push("Restricted Drizzle persistence preserves Thai, optional code/location, exact 08:45/10:15/10:30/12:00/16:00");
    await assert.rejects(repo.saveEntry(ids[0], { ...entry, revision: a.revision }), e => e instanceof Error && e.message === "duplicate");
    await assert.rejects(repo.saveEntry(ids[0], { ...entry, name: "Other", revision: 0 }), e => e instanceof Error && e.message === "conflict");
    await assert.rejects(repo.saveEntry(ids[0], { ...entry, name: "Conflict", start: "09:30", end: "11:00", revision: a.revision }), e => e instanceof Error && e.message === "overlap");
    a = await repo.saveEntry(ids[0], { ...entry, name: "Conflict", start: "09:30", end: "11:00", revision: a.revision, allowOverlap: true });
    assert.ok(placeOverlaps(a.sessions).some(p => p.lanes === 2));
    const aFriend = (await repo.listShared(ids[0])).find(f => f.id === ids[0])!;
    assert.equal(getAvailability(aFriend, new Date("2026-10-23T09:45:00+07:00")).current.length, 2);
    assert.equal(getAvailability(aFriend, new Date("2026-10-23T12:00:00+07:00")).kind, "free");
    checks.push("Duplicates/stale revision rejected; overlap requires explicit consent and renders separate lanes; Bangkok boundaries correct");
    await assert.rejects(repo.saveEntry(ids[1], { ...entry, id: first.id, revision: b.revision }));
    await assert.rejects(repo.deleteEntry(ids[2], { id: first.id, revision: 1 }));
    assert.ok((await repo.getOwn(ids[0]))?.sessions.some(s => s.id === first.id));
    await assert.rejects(repo.saveEntry(ids[0], { ...entry, memberId: ids[1], revision: a.revision }));
    checks.push("Another student and administrator cannot edit/delete target classes; forged ownership payload rejected");
    const raw = await runtime.connect();
    try {
      assert.equal((await raw.query("select * from public.timetable_entries")).rowCount, 0);
      await raw.query("BEGIN");
      await raw.query("select set_config('app.member_id',$1,true),set_config('app.policy_version',$2,true)", [ids[1], POLICY_VERSION]);
      assert.equal((await raw.query("delete from public.timetable_entries where id=$1", [first.id])).rowCount, 0);
      await assert.rejects(raw.query("INSERT INTO public.timetable_entries(member_id,course_name,day,start_time,end_time) VALUES($1,'forged',1,'09:00','10:00')", [ids[0]]), e => (e as { code: string }).code === "42501");
      await raw.query("ROLLBACK");
      assert.equal((await raw.query("select nullif(current_setting('app.member_id',true),'') as actor")).rows[0].actor, null);
    } finally { raw.release(); }
    checks.push("RLS independently denies cross-owner SQL, missing context sees no rows and context does not leak after rollback");
    const rollbackTest = await owner.connect();
    try {
      await assert.rejects(rollbackTest.query(readFileSync("operations/student-timetables.rollback.PROPOSED.sql", "utf8")));
      await rollbackTest.query("ROLLBACK");
      assert.equal((await readLedger(rollbackTest)).length, 3);
      assert.ok((await repo.getOwn(ids[0]))?.sessions.some(s => s.id === first.id));
    } finally { await rollbackTest.query("ROLLBACK"); rollbackTest.release(); }
    checks.push("Exact rollback refuses populated tables and leaves ledger/classes unchanged");
    await repo.saveEntry(ids[3], { ...entry, revision: 1 });
    assert.ok(!(await repo.listShared(ids[0])).some(f => ids.slice(3).includes(f.id)));
    await assert.rejects(repo.listShared(ids[3]));
    for (const id of ids.slice(4)) { await assert.rejects(repo.getOwn(id)); await assert.rejects(repo.saveTerm(id, term)); }
    await owner.query("update public.members set status='pending' where id=$1", [ids[0]]);
    assert.ok(!(await repo.listShared(ids[1])).some(f => f.id === ids[0]));
    await owner.query("update public.members set status='approved' where id=$1", [ids[0]]);
    checks.push("Pending students can prepare privately; pending/suspended/old-policy schedules excluded; approval loss immediately hides data");
    const versions = a.revision;
    const outcomes = await Promise.allSettled([
      repo.saveEntry(ids[0], { ...entry, name: "Race A", day: 1, revision: versions }),
      repo.saveEntry(ids[0], { ...entry, name: "Race B", day: 2, revision: versions }),
    ]);
    assert.equal(outcomes.filter(o => o.status === "fulfilled").length, 1);
    a = (await repo.getOwn(ids[0]))!;
    a = await repo.deleteEntry(ids[0], { id: first.id, revision: a.revision });
    assert.ok(!a.sessions.some(s => s.id === first.id));
    await assert.rejects(repo.saveEntry(ids[0], { ...entry, start: "12:00", end: "09:00", revision: a.revision }));
    checks.push("Concurrent edits serialize with one conflict; own delete persists; invalid ranges never write");
    // Read/SQL checks above use runtime; owner is only synthetic setup/cleanup.
  } finally {
    const rows = (await owner.query("SELECT id FROM public.members WHERE id=ANY($1::uuid[]) AND oidc_subject=ANY($2::text[])", [ids, subjects])).rows;
    assert.equal(rows.length, ids.length);
    await owner.query("DELETE FROM public.members WHERE id=ANY($1::uuid[]) AND oidc_subject=ANY($2::text[])", [ids, subjects]);
    assert.equal(await accountState(), beforeRecords);
  }
  assert.equal((await owner.query("select count(*)::int n from public.timetable_entries")).rows[0].n, 0);
  checks.push("Exact synthetic identity cleanup cascades timetable rows and preserves pre-existing control digest");
  const recovery = await owner.connect();
  try {
    await recovery.query(readFileSync("operations/student-timetables.rollback.PROPOSED.sql", "utf8"));
    assert.equal((await readLedger(recovery)).length, 2);
    assert.equal((await recovery.query("select to_regclass('public.student_timetables') is null as absent")).rows[0].absent, true);
    assert.equal(await accountState(), beforeRecords);
    assert.equal(await executeReviewedMigrations(recovery, "0002"), 1);
  } finally { recovery.release(); }
  checks.push("Exact guarded empty-table rollback removes only new objects/ledger row; accounts preserved and reapply succeeds");
  return { status: "PASS", checks, count: checks.length, migrationHash: migration.hash, productionConnected: false };
}
