import type { Availability, ClassSession, Friend, Occurrence } from "./types";

export const TIME_ZONE = "Asia/Bangkok";
export const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0] as const;
const bangkokParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export function minutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
export function localParts(now: Date) {
  const p = Object.fromEntries(
    bangkokParts.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  const date = `${p.year}-${p.month}-${p.day}`;
  return {
    date,
    day: new Date(`${date}T12:00:00+07:00`).getUTCDay(),
    time: `${p.hour}:${p.minute}`,
    minute: Number(p.hour) * 60 + Number(p.minute),
  };
}
export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function timestamp(date: string, time: string) {
  return new Date(`${date}T${time}:00+07:00`).getTime();
}
export function daySessions(friend: Friend, day: number) {
  return friend.sessions
    .filter((s) => s.day === day)
    .sort((a, b) => minutes(a.start) - minutes(b.start));
}
export function getAvailability(friend: Friend, now: Date): Availability {
  const local = localParts(now);
  const empty = { current: [], next: null, freeAt: null };
  if (
    !friend.semester ||
    (!friend.sessions.length && !friend.timetable) ||
    !friend.published
  )
    return { kind: "no-schedule", ...empty };
  let next: Occurrence | null = null;
  const firstDate =
    local.date < friend.semester.start ? friend.semester.start : local.date;
  for (let i = 0; i < 8; i++) {
    const date = addDays(firstDate, i);
    if (date > friend.semester.end) break;
    const day = new Date(`${date}T12:00:00Z`).getUTCDay();
    for (const session of daySessions(friend, day)) {
      const startsAt = timestamp(date, session.start);
      if (startsAt > now.getTime() && (!next || startsAt < next.startsAt))
        next = {
          session,
          date,
          startsAt,
          endsAt: timestamp(date, session.end),
        };
    }
  }
  if (local.date < friend.semester.start || local.date > friend.semester.end)
    return { kind: "out-of-term", ...empty, next };
  const today = daySessions(friend, local.day);
  const current = today.filter(
    (s) => minutes(s.start) <= local.minute && local.minute < minutes(s.end),
  );
  if (current.length) {
    // Follow overlapping and back-to-back sessions so “free at” means a real break.
    let end = Math.max(...current.map((s) => minutes(s.end)));
    for (const session of today)
      if (minutes(session.start) <= end && minutes(session.end) > end)
        end = minutes(session.end);
    return {
      kind: "in-class",
      current,
      next,
      freeAt: `${Math.floor(end / 60)
        .toString()
        .padStart(2, "0")}:${(end % 60).toString().padStart(2, "0")}`,
    };
  }
  return {
    kind:
      next && next.startsAt - now.getTime() <= 60 * 60_000
        ? "upcoming"
        : "free",
    current,
    next,
    freeAt: null,
  };
}
export function nextLabel(next: Occurrence, now: Date) {
  const today = localParts(now).date;
  const when =
    next.date === today
      ? "Today"
      : next.date === addDays(today, 1)
        ? "Tomorrow"
        : new Intl.DateTimeFormat("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            timeZone: TIME_ZONE,
          }).format(new Date(next.startsAt));
  return `${when}, ${next.session.start}`;
}
export const statusLabel: Record<Availability["kind"], string> = {
  "in-class": "In class",
  free: "Free now",
  upcoming: "Class soon",
  "no-schedule": "No schedule",
  "out-of-term": "Outside semester",
};

export interface PlacedSession {
  session: ClassSession;
  lane: number;
  lanes: number;
}
export function placeOverlaps(sessions: ClassSession[]): PlacedSession[] {
  const result: PlacedSession[] = [];
  const sorted = [...sessions].sort(
    (a, b) => minutes(a.start) - minutes(b.start),
  );
  let group: PlacedSession[] = [],
    groupEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...group.map((s) => s.lane + 1));
    group.forEach((s) => {
      s.lanes = lanes;
    });
    result.push(...group);
    group = [];
  };
  for (const session of sorted) {
    if (minutes(session.start) >= groupEnd) {
      flush();
      groupEnd = -1;
    }
    const used = group
      .filter((p) => minutes(p.session.end) > minutes(session.start))
      .map((p) => p.lane);
    let lane = 0;
    while (used.includes(lane)) lane++;
    group.push({ session, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, minutes(session.end));
  }
  flush();
  return result;
}
