import { and, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { members, studentTimetables, timetableEntries } from "./schema";
import { POLICY_VERSION, type Member } from "../lib/auth/domain";
import { conflicts, courseColor, deleteInput, entryInput, termInput, TimetableError, type TimetableSnapshot } from "../lib/timetable/model";
import type { Day, Friend } from "../lib/types";

type Tx = Parameters<Parameters<NodePgDatabase["transaction"]>[0]>[0];
type Term = typeof studentTimetables.$inferSelect;
type Entry = typeof timetableEntries.$inferSelect;
const eligible = (m: Member) => m.status !== "suspended" && !!m.profileCompletedAt && !!m.policyAcceptedAt && m.policyVersion === POLICY_VERSION;
const shared = (m: Member) => eligible(m) && m.status === "approved";
const snapshot = (term: Term, entries: Entry[]): TimetableSnapshot => ({
  semester: { name: term.name, start: term.startDate, end: term.endDate },
  revision: term.revision, updatedAt: term.updatedAt.toISOString(),
  sessions: entries.map(e => ({ id: e.id, name: e.courseName, code: e.courseCode, section: e.section, day: e.day as Day, start: e.start.slice(0, 5), end: e.end.slice(0, 5), room: e.room, color: courseColor(e.courseCode, e.courseName) })),
});
export function projectStudent(member: Member, timetable: TimetableSnapshot | null, storageReady = true): Friend {
  return { id: member.id, nickname: member.nickname, thaiName: member.thaiName, department: member.department, initials: member.nickname[0]?.toUpperCase() || "?", avatar: 0,
    semester: timetable?.semester ?? null, sessions: timetable?.sessions ?? [], published: timetable !== null,
    timetable: { revision: timetable?.revision ?? 0, updatedAt: timetable?.updatedAt ?? null, storageReady } };
}

/** Actor IDs MUST come from validated Auth.js sessions, never request/form
 * ownership fields. The server-only factory lives in src/db/index.ts.
 * RLS context is transaction-local, not a Supabase Auth JWT claim. */
export function createTimetableRepository(db: NodePgDatabase) {
  async function asActor<T>(actorId: string, work: (tx: Tx, actor: Member) => Promise<T>): Promise<T> {
    return db.transaction(async tx => {
      await tx.execute(sql`select set_config('app.member_id', ${actorId}, true), set_config('app.policy_version', ${POLICY_VERSION}, true)`);
      const [actor] = await tx.select().from(members).where(eq(members.id, actorId)).for("share");
      if (!actor || !eligible(actor)) throw new TimetableError("access");
      return work(tx, actor);
    });
  }
  async function load(tx: Tx, actorId: string) {
    const [term] = await tx.select().from(studentTimetables).where(eq(studentTimetables.memberId, actorId));
    if (!term) return null;
    return snapshot(term, await tx.select().from(timetableEntries).where(eq(timetableEntries.memberId, actorId)).orderBy(timetableEntries.day, timetableEntries.start, timetableEntries.id));
  }
  async function lock(tx: Tx, actorId: string, revision: number) {
    const [term] = await tx.select().from(studentTimetables).where(eq(studentTimetables.memberId, actorId)).for("update");
    if (!term) throw new TimetableError("missing");
    if (term.revision !== revision) throw new TimetableError("conflict");
    return term;
  }
  async function changed(tx: Tx, actorId: string) {
    await tx.update(studentTimetables).set({ revision: sql`${studentTimetables.revision} + 1`, updatedAt: new Date() }).where(eq(studentTimetables.memberId, actorId));
    return (await load(tx, actorId))!;
  }
  return {
    getOwn: (actorId: string) => asActor(actorId, tx => load(tx, actorId)),
    async saveTerm(actorId: string, input: unknown) {
      const data = termInput.parse(input);
      return asActor(actorId, async tx => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${actorId}, 0))`);
        const [existing] = await tx.select().from(studentTimetables).where(eq(studentTimetables.memberId, actorId)).for("update");
        if ((existing?.revision ?? 0) !== data.revision) throw new TimetableError("conflict");
        const values = { name: data.name, startDate: data.start, endDate: data.end };
        if (existing) await tx.update(studentTimetables).set(values).where(eq(studentTimetables.memberId, actorId));
        else await tx.insert(studentTimetables).values({ memberId: actorId, ...values });
        return changed(tx, actorId);
      });
    },
    async saveEntry(actorId: string, input: unknown) {
      const data = entryInput.parse(input);
      return asActor(actorId, async tx => {
        await lock(tx, actorId, data.revision);
        const entries = await tx.select().from(timetableEntries).where(eq(timetableEntries.memberId, actorId));
        if (data.id && !entries.some(e => e.id === data.id)) throw new TimetableError("missing");
        if (!data.id && entries.length >= 200) throw new TimetableError("limit");
        const others = entries.filter(e => e.id !== data.id);
        if (others.some(e => e.courseName === data.name && e.courseCode === data.code && e.section === data.section && e.room === data.room && e.day === data.day && e.start.slice(0, 5) === data.start && e.end.slice(0, 5) === data.end)) throw new TimetableError("duplicate");
        if (!data.allowOverlap && others.some(e => conflicts(data, { ...e, start: e.start.slice(0, 5), end: e.end.slice(0, 5) }))) throw new TimetableError("overlap");
        const values = { courseName: data.name, courseCode: data.code, section: data.section, room: data.room, day: data.day, start: data.start, end: data.end };
        if (data.id) await tx.update(timetableEntries).set(values).where(and(eq(timetableEntries.id, data.id), eq(timetableEntries.memberId, actorId)));
        else await tx.insert(timetableEntries).values({ memberId: actorId, ...values });
        return changed(tx, actorId);
      });
    },
    async deleteEntry(actorId: string, input: unknown) {
      const data = deleteInput.parse(input);
      return asActor(actorId, async tx => {
        await lock(tx, actorId, data.revision);
        const removed = await tx.delete(timetableEntries).where(and(eq(timetableEntries.id, data.id), eq(timetableEntries.memberId, actorId))).returning({ id: timetableEntries.id });
        if (removed.length !== 1) throw new TimetableError("missing");
        return changed(tx, actorId);
      });
    },
    async listShared(actorId: string): Promise<Friend[]> {
      return asActor(actorId, async (tx, actor) => {
        if (!shared(actor)) throw new TimetableError("access");
        // Also filter with owner connections that bypass RLS. No admin write override.
        const people = (await tx.select().from(members).where(and(eq(members.status, "approved"), eq(members.policyVersion, POLICY_VERSION)))).filter(shared);
        if (!people.length) return [];
        const ids = people.map(p => p.id);
        const terms = await tx.select().from(studentTimetables).where(inArray(studentTimetables.memberId, ids));
        const entries = await tx.select().from(timetableEntries).where(inArray(timetableEntries.memberId, ids));
        return people.map(p => { const t = terms.find(t => t.memberId === p.id); return projectStudent(p, t ? snapshot(t, entries.filter(e => e.memberId === p.id)) : null); });
      });
    },
  };
}
