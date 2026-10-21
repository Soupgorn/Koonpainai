import { Pool } from "pg";
import { createHash } from "node:crypto";
import { databaseConfig } from "./connection";

type Registry = { pool?: Pool; key?: string; closing: boolean; failed?: boolean; pools: Set<Pool>; drains: Set<Promise<void>> };
const globalState = globalThis as typeof globalThis & { koonpinaiRuntimePoolRegistry?: Registry };
const state = globalState.koonpinaiRuntimePoolRegistry ??= { closing: false, pools: new Set(), drains: new Set() };

function retire(pool: Pool) {
  const draining = pool.end().catch(() => { state.failed = true; throw new Error("DATABASE_DRAIN_FAILED"); }).finally(() => { state.pools.delete(pool); state.drains.delete(draining); });
  state.drains.add(draining);
  // A later shutdown still awaits/reports this drain; never emit raw pg errors.
  void draining.catch(() => {});
}
export function retireLegacyRuntimePool(pool: Pool) {
  if (!state.pools.has(pool)) { state.pools.add(pool); retire(pool); }
}
export function getRuntimePool(): Pool {
  if (state.closing) throw new Error("DATABASE_DRAINING");
  const config = databaseConfig();
  const key = createHash("sha256").update(JSON.stringify(config)).digest("hex");
  if (state.pool && state.key === key) return state.pool;
  if (state.pool) retire(state.pool);
  const pool = new Pool(config);
  pool.on("error", () => console.error("[database] Connection unavailable."));
  state.pool = pool; state.key = key; state.pools.add(pool);
  return pool;
}
/** Called only after HTTP and Next after() work have drained. Never creates a pool. */
export async function closeRuntimePools(): Promise<void> {
  state.closing = true;
  if (state.pool) { retire(state.pool); state.pool = undefined; }
  await Promise.all([...state.drains]);
  if (state.pools.size || state.failed) throw new Error("DATABASE_DRAIN_INCOMPLETE");
}
