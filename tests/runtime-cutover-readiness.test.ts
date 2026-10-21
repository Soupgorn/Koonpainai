import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { runtimeOnlyEnvironment, assertNoRuntimeDotenv, assessCutoverCapacity } from "../scripts/runtime-cutover-readiness";

const url = "postgresql://koonpinai_runtime.fixture:fictional@fixture.pooler.supabase.com:5432/postgres";
test("Proposed runtime launch environment excludes migration, provider, inherited PostgreSQL and injection settings", () => {
  const source = { MIGRATION_DATABASE_URL: "fictional-migration", DIRECT_DATABASE_URL: "fictional-owner", DATABASE_URL: "fictional-owner", PGPASSWORD: "fictional", PGHOST: "fictional", SUPABASE_SERVICE_ROLE_KEY: "fictional", NODE_OPTIONS: "--require=fixture", ENABLE_UI_PREVIEW: "true", AUTH_SECRET: "unchanged-fictional-auth-secret", AUTH_URL: "https://app.example", PATH: "fixture-path" };
  const env = runtimeOnlyEnvironment(source, url, "/run/koonpinai/ca.crt");
  assert.equal(env.DATABASE_URL, url); assert.equal(env.AUTH_SECRET, source.AUTH_SECRET);
  assert.equal(env.NODE_ENV, "production");
  for (const key of ["MIGRATION_DATABASE_URL", "DIRECT_DATABASE_URL", "PGPASSWORD", "PGHOST", "SUPABASE_SERVICE_ROLE_KEY", "NODE_OPTIONS", "ENABLE_UI_PREVIEW"]) assert.equal(env[key], undefined);
  assert.equal(source.DATABASE_URL, "fictional-owner");
});
test("Runtime launch refuses owner, transaction, weak TLS URL flags and global bypass", () => {
  for (const candidate of [url.replace("koonpinai_runtime", "postgres"), url.replace(":5432", ":6543"), url + "?sslmode=require", url + "?host=elsewhere"])
    assert.throws(() => runtimeOnlyEnvironment({}, candidate, "fixture-ca"));
  assert.throws(() => runtimeOnlyEnvironment({ NODE_TLS_REJECT_UNAUTHORIZED: "0" }, url, "fixture-ca"));
});
test("A clean bundle is required because Next.js loads root dotenv after process spawn", () => {
  const dir = mkdtempSync(join(tmpdir(), "koonpinai-runtime-fixture-"));
  try { assertNoRuntimeDotenv(dir); writeFileSync(join(dir, ".env.local"), "MIGRATION_DATABASE_URL=fictional"); assert.throws(() => assertNoRuntimeDotenv(dir)); }
  finally {
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    assert.ok(basename(dir).startsWith("koonpinai-runtime-fixture-"));
    rmSync(dir, { recursive: true, force: true });
  }
});
const budget = { dbMax: 60, reserved: 3, otherBackendBudget: 10, headroom: 10, oldProcesses: 1, newProcesses: 1, canaryProcesses: 0, operationalConnections: 1 };
test("Capacity requires verified provider limits, includes old retained pool and rolling overlap", () => {
  assert.equal(assessCutoverCapacity(budget).decision, "NO-GO");
  const fit = assessCutoverCapacity({ ...budget, poolSize: 10, maxClients: 100 });
  assert.equal(fit.decision, "GO"); assert.equal(fit.clientCeiling, 8); assert.equal(fit.conservativeBackends, 50);
  assert.ok(assessCutoverCapacity({ ...budget, poolSize: 1, maxClients: 100 }).reasons.includes("DEDICATED_SESSION_POOL_EXCEEDED"));
  assert.ok(assessCutoverCapacity({ ...budget, poolSize: 30, maxClients: 5 }).reasons.includes("HOSTED_CLIENT_BUDGET_EXCEEDED"));
  assert.ok(assessCutoverCapacity({ ...budget, poolSize: 30, maxClients: 100 }).reasons.includes("POSTGRES_BACKEND_BUDGET_EXCEEDED"));
  // Owner supplied project settings, one replacement + one existing process.
  // Eight observed provider/other client backends, five-slot safety reserve.
  const project = assessCutoverCapacity({ ...budget, poolSize: 15, maxClients: 200, otherBackendBudget: 8, headroom: 5, canaryProcesses: 0 });
  assert.equal(project.clientCeiling, 8);
  assert.equal(project.conservativeBackends, 58);
  assert.equal(project.decision, "NO-GO");
  const controlled=assessCutoverCapacity({...budget,poolSize:15,maxClients:200,otherBackendBudget:12,headroom:5,controlledRuntimeBackendBudget:6});
  assert.equal(controlled.controlledBackends,53);assert.equal(controlled.controlledDecision,"CONDITIONAL-GO");
  assert.equal(controlled.decision,"NO-GO");
  assert.equal(assessCutoverCapacity({...budget,poolSize:15,maxClients:200,controlledRuntimeBackendBudget:6,migrationConnections:1}).controlledDecision,"NO-GO");
  assert.throws(() => assessCutoverCapacity({ ...budget, oldProcesses: -1 }));
});
