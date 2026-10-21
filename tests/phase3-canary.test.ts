import test from "node:test";
import assert from "node:assert/strict";
import { assertLocalCanaryTarget } from "../scripts/phase3-canary";
test("Phase 3 synthetic canary refuses hosted, default-port and non-fixture database targets", () => {
  assert.doesNotThrow(() => assertLocalCanaryTarget("127.0.0.1", 55434, "phase3_synthetic"));
  for (const [host, port, database] of [["db.example.supabase.co", 55434, "phase3_synthetic"], ["127.0.0.1", 5432, "phase3_synthetic"], ["127.0.0.1", 55434, "postgres"], ["localhost", 55434, "phase3_synthetic"]]) {
    assert.throws(() => assertLocalCanaryTarget(host, port, database));
  }
});
