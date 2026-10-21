import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  date,
  integer,
  smallint,
  time,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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

// One current weekly timetable per student. Historic terms are not overwritten
// by a background integration; changing dates is an explicit owner action.
export const studentTimetables = pgTable("student_timetables", {
  memberId: uuid("member_id").primaryKey().references(() => members.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  revision: integer("revision").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, t => [
  check("timetable_dates", sql`${t.startDate} <= ${t.endDate}`),
  check("timetable_name", sql`length(btrim(${t.name})) BETWEEN 1 AND 100`),
  check("timetable_revision", sql`${t.revision} >= 0`),
]).enableRLS();
export const timetableEntries = pgTable("timetable_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  memberId: uuid("member_id").notNull().references(() => studentTimetables.memberId, { onDelete: "cascade" }),
  courseName: text("course_name").notNull(),
  courseCode: text("course_code").notNull().default(""),
  section: text("section").notNull().default(""),
  day: smallint("day").notNull(),
  start: time("start_time", { precision: 0 }).notNull(),
  end: time("end_time", { precision: 0 }).notNull(),
  room: text("room").notNull().default(""),
}, t => [
  index("timetable_entries_owner").on(t.memberId),
  uniqueIndex("timetable_entries_duplicate").on(t.memberId, t.courseName, t.courseCode, t.section, t.day, t.start, t.end, t.room),
  check("entry_name", sql`length(btrim(${t.courseName})) BETWEEN 1 AND 240`),
  check("entry_optional_lengths", sql`length(${t.courseCode}) <= 64 AND length(${t.section}) <= 24 AND length(${t.room}) <= 160`),
  check("entry_weekday", sql`${t.day} BETWEEN 0 AND 6`),
  check("entry_times", sql`${t.start} < ${t.end} AND ${t.end} < time '24:00' AND extract(second from ${t.start}) = 0 AND extract(second from ${t.end}) = 0`),
]).enableRLS();
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
