import { z } from "zod";
import type { ClassSession, Semester } from "../types";

const date = z.string().refine(v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Choose a valid date.");
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Use a valid time.");
const optional = (max: number) => z.string().trim().max(max).default("");
export const termInput = z.object({
  name: z.string().trim().min(1, "Enter a semester name.").max(100),
  start: date, end: date,
  revision: z.number().int().min(0),
}).strict().refine(v => v.start <= v.end, { path: ["end"], message: "End date must be on or after start date." });
export const entryInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Enter a course name.").max(240),
  code: optional(64), section: optional(24), room: optional(160),
  day: z.number().int().min(0).max(6), start: clock, end: clock,
  revision: z.number().int().min(0),
  allowOverlap: z.boolean().default(false),
}).strict().refine(v => v.start < v.end, { path: ["end"], message: "End time must be after start time. Split overnight classes into separate days." });
export const deleteInput = z.object({ id: z.uuid(), revision: z.number().int().min(0) }).strict();
export type EntryInput = z.infer<typeof entryInput>;
export interface TimetableSnapshot {
  semester: Semester;
  sessions: ClassSession[];
  revision: number;
  updatedAt: string;
}
export type TimetableResult = { error: string; snapshot?: TimetableSnapshot };
export class TimetableError extends Error {
  constructor(readonly code: "access" | "conflict" | "overlap" | "duplicate" | "missing" | "limit") { super(code); }
}
export function conflicts(a: { day: number; start: string; end: string }, b: { day: number; start: string; end: string }) {
  return a.day === b.day && a.start < b.end && b.start < a.end;
}
export function courseColor(code: string, name: string) {
  return Array.from(code || name).reduce((n, c) => (n * 31 + c.codePointAt(0)!) >>> 0, 0) % 6;
}
export function timetableMessage(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Check the class details.";
  if (error instanceof TimetableError) return {
    access: "You can only manage your own timetable with current sharing acknowledgement. Suspended accounts cannot make changes.",
    conflict: "Your timetable changed in another tab. Reload before saving again.",
    overlap: "This class overlaps another class. Review the times and explicitly allow the overlap to save.",
    duplicate: "This exact class is already in your timetable.",
    missing: "The class or semester was not found. Reload your timetable.",
    limit: "A timetable can contain up to 200 classes.",
  }[error.code];
  return "Your timetable could not be saved. Check your connection and try again. If storage is not enabled yet, contact the administrator.";
}
