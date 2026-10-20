import { z } from "zod";
import type { DraftSession } from "./types";
import type { ClassSession, Semester } from "../types";
import { minutes } from "../schedule";

const date = z
  .string()
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    "Choose a valid date.",
  );
export const semesterSchema = z
  .object({
    name: z.string().trim().min(1, "Add an academic semester.").max(100),
    start: date,
    end: date,
  })
  .refine((term) => term.start <= term.end, {
    message: "Semester end must be on or after its start.",
    path: ["end"],
  });
export const classSessionSchema = z
  .object({
    id: z.string().min(1).max(100),
    code: z
      .string()
      .trim()
      .regex(/^\d{8}$/, "Use the eight-digit course code shown in the PDF."),
    name: z.string().trim().min(1, "Add a course name.").max(240),
    section: z.string().trim().min(1, "Add a section.").max(24),
    day: z.union([
      z.literal(0),
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ]),
    start: z
      .string()
      .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Use a valid start time."),
    end: z
      .string()
      .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Use a valid end time."),
    room: z.string().trim().min(1, "Add a classroom.").max(160),
    color: z.number().int().min(0).max(5),
  })
  .refine((session) => minutes(session.start) < minutes(session.end), {
    message: "End time must be after start time.",
    path: ["end"],
  });

export const scheduleExportSchema = z
  .object({
    schemaVersion: z.literal(1),
    timeZone: z.literal("Asia/Bangkok"),
    weekdayConvention: z.literal(
      "0=Sunday,1=Monday,2=Tuesday,3=Wednesday,4=Thursday,5=Friday,6=Saturday",
    ),
    nickname: z.string().trim().min(1, "Add your friend’s nickname.").max(40),
    semester: semesterSchema,
    sessions: z
      .array(classSessionSchema)
      .min(1, "Add at least one class.")
      .max(300),
  })
  .superRefine((schedule, ctx) => {
    const ids = new Set<string>();
    schedule.sessions.forEach((session, index) => {
      if (ids.has(session.id))
        ctx.addIssue({
          code: "custom",
          message: "Each session needs a unique ID.",
          path: ["sessions", index, "id"],
        });
      ids.add(session.id);
    });
  });
export type ScheduleExport = z.infer<typeof scheduleExportSchema>;
export function toScheduleExport(
  nickname: string,
  semester: Semester,
  sessions: DraftSession[] | ClassSession[],
): ScheduleExport {
  // Explicit projection excludes source text, identifiers, filenames and OCR evidence.
  return scheduleExportSchema.parse({
    schemaVersion: 1,
    timeZone: "Asia/Bangkok",
    weekdayConvention:
      "0=Sunday,1=Monday,2=Tuesday,3=Wednesday,4=Thursday,5=Friday,6=Saturday",
    nickname,
    semester,
    sessions: sessions.map(
      ({ id, code, name, section, day, start, end, room, color }) => ({
        id,
        code,
        name,
        section,
        day,
        start,
        end,
        room,
        color,
      }),
    ),
  });
}
export function draftErrors(session: DraftSession): string[] {
  const parsed = classSessionSchema.safeParse(session);
  return parsed.success
    ? []
    : parsed.error.issues.map((issue) =>
        issue.path[0] === "day" ? "Choose the class day." : issue.message,
      );
}
