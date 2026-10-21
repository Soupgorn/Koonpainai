import type { ClassSession, Semester } from "../types";
import { minutes } from "../schedule";
export function sessionErrors(s: ClassSession): string[] {
  const errors: string[] = [];
  if (!s.name.trim()) errors.push("Add a course name.");
  if (!Number.isInteger(s.day) || s.day < 0 || s.day > 6)
    errors.push("Choose a valid day.");
  const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!validTime.test(s.start) || !validTime.test(s.end))
    errors.push("Use valid start and end times.");
  else if (minutes(s.start) >= minutes(s.end))
    errors.push("End time must be after start time.");
  return errors;
}
export function scheduleErrors(
  nickname: string,
  semester: Semester,
  sessions: ClassSession[],
) {
  const errors: string[] = [];
  if (!nickname.trim()) errors.push("Add your friend’s nickname.");
  if (!semester.name.trim()) errors.push("Add an academic semester.");
  const validDate = (d: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    !Number.isNaN(Date.parse(d)) &&
    new Date(d).toISOString().slice(0, 10) === d;
  if (!validDate(semester.start) || !validDate(semester.end))
    errors.push("Choose valid semester dates.");
  else if (semester.start > semester.end)
    errors.push("Semester end must be on or after its start.");
  if (!sessions.length) errors.push("Add at least one class.");
  sessions.forEach((s, i) =>
    sessionErrors(s).forEach((e) => errors.push(`Class ${i + 1}: ${e}`)),
  );
  return errors;
}
export function overlapCount(sessions: ClassSession[]) {
  let count = 0;
  sessions.forEach((s, i) =>
    sessions.slice(i + 1).forEach((t) => {
      if (
        s.day === t.day &&
        minutes(s.start) < minutes(t.end) &&
        minutes(t.start) < minutes(s.end)
      )
        count++;
    }),
  );
  return count;
}
