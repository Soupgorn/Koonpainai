import "server-only";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { createMemberRepository } from "./member-repository";
import type { MemberRepository } from "../lib/auth/domain";
import { getRuntimePool, retireLegacyRuntimePool } from "./runtime-pool";
import { createTimetableRepository } from "./timetable-repository";
export function getTimetableRepository() {
  return createTimetableRepository(drizzle(getRuntimePool()));
}
const state = globalThis as typeof globalThis & {
  koonpinaiPool?: Pool;
  koonpinaiMembers?: MemberRepository;
  koonpinaiVerifiedPool?: Pool;
  koonpinaiVerifiedMembers?: MemberRepository;
  koonpinaiVerifiedConfigKey?: string;
};
// Retire the pre-TLS hot-reload cache rather than reusing an unverified pool.
if (state.koonpinaiPool) {
  void state.koonpinaiPool.end().catch(() => {});
  delete state.koonpinaiPool;
  delete state.koonpinaiMembers;
}
export function getMemberRepository(): MemberRepository {
  if (!process.env.DATABASE_URL)
    throw new Error("Account storage is not configured");
  const pool = getRuntimePool();
  if (state.koonpinaiVerifiedPool === pool && state.koonpinaiVerifiedMembers)
    return state.koonpinaiVerifiedMembers;
  if (state.koonpinaiVerifiedPool && state.koonpinaiVerifiedPool !== pool)
    retireLegacyRuntimePool(state.koonpinaiVerifiedPool);
  state.koonpinaiVerifiedPool = pool;
  return (state.koonpinaiVerifiedMembers = createMemberRepository(
    drizzle(pool),
  ));
}
