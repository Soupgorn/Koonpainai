import { and, eq, gt, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { applicationSessions, members } from "./schema";
import { memberGate, type MemberRepository } from "../lib/auth/domain";
export function createMemberRepository(db: NodePgDatabase): MemberRepository {
  return {
    async login(identity, sessionId, expiresAt) {
      return db.transaction(async (tx) => {
        const [member] = await tx
          .insert(members)
          .values(identity)
          .onConflictDoUpdate({
            target: [members.issuer, members.subject],
            set: {
              displayName: identity.displayName,
              email: identity.email,
              lastLoginAt: new Date(),
              updatedAt: new Date(),
            },
          })
          .returning();
        await tx
          .insert(applicationSessions)
          .values({ id: sessionId, memberId: member.id, expiresAt });
        return member;
      });
    },
    async activeSession(sessionId) {
      const [row] = await db
        .select({ member: members })
        .from(applicationSessions)
        .innerJoin(members, eq(members.id, applicationSessions.memberId))
        .where(
          and(
            eq(applicationSessions.id, sessionId),
            isNull(applicationSessions.revokedAt),
            gt(applicationSessions.expiresAt, new Date()),
          ),
        )
        .limit(1);
      return row?.member ?? null;
    },
    async revokeSession(sessionId) {
      await db
        .update(applicationSessions)
        .set({ revokedAt: new Date() })
        .where(eq(applicationSessions.id, sessionId));
    },
    async find(id) {
      const [member] = await db
        .select()
        .from(members)
        .where(eq(members.id, id))
        .limit(1);
      return member ?? null;
    },
    async saveProfile(id, input) {
      await db
        .update(members)
        .set({
          ...input,
          profileCompletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(members.id, id));
    },
    async acknowledgePolicy(id, version) {
      await db
        .update(members)
        .set({
          policyVersion: version,
          policyAcceptedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(members.id, id));
    },
    async list() {
      return db.select().from(members).orderBy(members.createdAt);
    },
    async setStatus(actorId, id, status) {
      await db.transaction(async (tx) => {
        const [actor] = await tx
          .select()
          .from(members)
          .where(eq(members.id, actorId))
          .for("update");
        if (
          !actor ||
          actor.role !== "admin" ||
          memberGate(actor) !== "allowed" ||
          actorId === id
        )
          throw new Error("Access change not permitted");
        const changed = await tx
          .update(members)
          .set({ status, updatedAt: new Date() })
          .where(eq(members.id, id))
          .returning({ id: members.id });
        if (changed.length !== 1) throw new Error("Account not found");
      });
    },
  };
}
