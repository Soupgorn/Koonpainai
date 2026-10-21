import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { createMemberRepository } from "../src/db/member-repository";

import { databaseConfig } from "../src/db/connection";
import {
  KMITL_ISSUER,
  POLICY_VERSION,
  memberGate,
} from "../src/lib/auth/domain";

// Explicit opt-in only. The real database is exercised through temporary tables
// on one transaction-bound connection; no fixture user enters the public tables.
test(
  "PostgreSQL: identity reuse, profile/policy gates, authorization and revocation",
  { skip: process.env.RUN_AUTH_DB_TESTS !== "true" },
  async () => {
    const { loadEnvConfig } = await import("@next/env");
    loadEnvConfig(process.cwd());
    assert.ok(
      process.env.DATABASE_URL,
      "Configure the ignored local database URL first",
    );
    const pool = new Pool(databaseConfig());
    try {
      await drizzle(pool).transaction(async (tx) => {
        const security = await tx.execute(
          sql.raw(
            "SELECT bool_and(relrowsecurity) AS enabled, count(*)::int AS tables FROM pg_class WHERE oid IN ('public.members'::regclass, 'public.application_sessions'::regclass)",
          ),
        );
        assert.equal(security.rows[0].tables, 2);
        assert.equal(security.rows[0].enabled, true);
        await tx.execute(
          sql.raw(
            "CREATE TEMP TABLE members (LIKE public.members INCLUDING ALL) ON COMMIT DROP",
          ),
        );
        await tx.execute(
          sql.raw(
            "CREATE TEMP TABLE application_sessions (LIKE public.application_sessions INCLUDING ALL) ON COMMIT DROP",
          ),
        );
        await tx.execute(
          sql.raw(
            "ALTER TABLE pg_temp.application_sessions ADD FOREIGN KEY (member_id) REFERENCES pg_temp.members(id)",
          ),
        );
        const repository = createMemberRepository(
          tx as unknown as Parameters<typeof createMemberRepository>[0],
        );
        const identity = {
          issuer: KMITL_ISSUER,
          subject: "sanitized-" + randomUUID(),
          displayName: "Fictional Student",
          email: null,
        };
        const sid = randomUUID(),
          deadline = new Date(Date.now() + 60000);
        const first = await repository.login(identity, sid, deadline);
        assert.equal(memberGate(first), "profile");
        await repository.saveProfile(first.id, {
          nickname: "Mild",
          thaiName: "มายด์",
          department: "Engineering",
        });
        assert.equal(memberGate((await repository.find(first.id))!), "policy");
        await repository.acknowledgePolicy(first.id, POLICY_VERSION);
        assert.equal(memberGate((await repository.find(first.id))!), "pending");
        const second = await repository.login(
          { ...identity, displayName: "Updated Name" },
          randomUUID(),
          deadline,
        );
        assert.equal(second.id, first.id);
        assert.equal(second.nickname, "Mild");
        assert.equal(second.status, "pending");
        assert.equal((await repository.list()).length, 1);
        await assert.rejects(
          repository.setStatus(first.id, first.id, "approved"),
        );
        const admin = await repository.login(
          { ...identity, subject: "admin-" + randomUUID() },
          randomUUID(),
          deadline,
        );
        await repository.saveProfile(admin.id, {
          nickname: "Admin",
          thaiName: "",
          department: "Engineering",
        });
        await repository.acknowledgePolicy(admin.id, POLICY_VERSION);
        await tx.execute(
          sql`UPDATE members SET role='admin', status='approved' WHERE id=${admin.id}`,
        );
        await repository.setStatus(admin.id, first.id, "approved");
        assert.equal(memberGate((await repository.find(first.id))!), "allowed");
        await repository.setStatus(admin.id, first.id, "suspended");
        assert.equal(
          memberGate((await repository.find(first.id))!),
          "suspended",
        );
        await assert.rejects(
          repository.setStatus(admin.id, admin.id, "pending"),
        );
        assert.ok(await repository.activeSession(sid));
        await repository.revokeSession(sid);
        assert.equal(await repository.activeSession(sid), null);
        const expired = randomUUID();
        await repository.login(identity, expired, new Date(Date.now() - 1000));
        assert.equal(await repository.activeSession(expired), null);
      });
    } catch {
      // Database drivers can embed a connection string in nested errors.
      throw new Error(
        "PostgreSQL integration check failed; connection details are redacted.",
      );
    } finally {
      await pool.end();
    }
  },
);
