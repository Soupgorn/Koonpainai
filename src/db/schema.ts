import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
export const approvalStatus = pgEnum("approval_status", [
  "pending",
  "approved",
  "suspended",
]);
export const memberRole = pgEnum("member_role", ["member", "admin"]);
export const members = pgTable(
  "members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    issuer: text("oidc_issuer").notNull(),
    subject: text("oidc_subject").notNull(),
    displayName: text("display_name").notNull(),
    email: text("verified_email"),
    nickname: text("nickname").notNull().default(""),
    thaiName: text("thai_name").notNull().default(""),
    department: text("department").notNull().default(""),
    profileCompletedAt: timestamp("profile_completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    policyVersion: text("policy_version"),
    policyAcceptedAt: timestamp("policy_accepted_at", {
      withTimezone: true,
      mode: "date",
    }),
    status: approvalStatus("status").notNull().default("pending"),
    role: memberRole("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    lastLoginAt: timestamp("last_login_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("members_oidc_identity").on(t.issuer, t.subject)],
).enableRLS();
/** Revocation records augment encrypted JWTs; no provider tokens are persisted. */
export const applicationSessions = pgTable(
  "application_sessions",
  {
    id: uuid("id").primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("application_sessions_member").on(t.memberId)],
).enableRLS();
