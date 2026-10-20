import "server-only";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { createMemberRepository } from "./member-repository";
import type { MemberRepository } from "../lib/auth/domain";
const state = globalThis as typeof globalThis & {
  koonpinaiPool?: Pool;
  koonpinaiMembers?: MemberRepository;
};
export function getMemberRepository(): MemberRepository {
  if (state.koonpinaiMembers) return state.koonpinaiMembers;
  if (!process.env.DATABASE_URL)
    throw new Error("Account storage is not configured");
  const pool =
    state.koonpinaiPool ??
    new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  pool.on("error", () => console.error("[database] Connection unavailable."));
  state.koonpinaiPool = pool;
  return (state.koonpinaiMembers = createMemberRepository(drizzle(pool)));
}
