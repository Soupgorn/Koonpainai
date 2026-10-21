import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { randomUUID } from "node:crypto";
import { entryInput, termInput, conflicts, courseColor } from "../src/lib/timetable/model";
import { getAvailability, placeOverlaps } from "../src/lib/schedule";
import type { Friend } from "../src/lib/types";
import { WeeklyTimetable } from "../src/components/weekly-timetable";
import { ClockProvider } from "../src/components/clock-provider";
const base = { name: "Linear Algebra", day: 5, start: "08:45", end: "10:15", revision: 0 };
test("student input requires name/day/exact times, permits missing optional fields and rejects client ownership", () => {
  const entry = entryInput.parse(base);
  assert.equal(entry.code, ""); assert.equal(entry.room, ""); assert.equal(entry.section, "");
  for (const change of [{ name: " " }, { day: 7 }, { day: -1 }, { day: 1.5 }, { start: "8:45" }, { start: "08:45:01" }, { end: "08:45" }, { end: "07:00" }, { end: "24:00" }, { memberId: randomUUID() }, { id: "not-a-uuid" }, { revision: -1 }]) assert.equal(entryInput.safeParse({ ...base, ...change }).success, false);
});
test("semester validation rejects impossible/reversed dates without inventing dates", () => {
  const term = { name: "1 / 2569", start: "2026-08-01", end: "2026-12-31", revision: 0 };
  assert.ok(termInput.safeParse(term).success);
  for (const change of [{ name: "" }, { start: "2026-02-30" }, { end: "2026-07-31" }, { owner: randomUUID() }]) assert.equal(termInput.safeParse({ ...term, ...change }).success, false);
});
test("overlap detection preserves adjacent sessions and consistent course identity", () => {
  assert.equal(conflicts(base, { ...base, start: "10:15", end: "12:00" }), false);
  assert.equal(conflicts(base, { ...base, start: "09:30" }), true);
  assert.equal(conflicts(base, { ...base, day: 4 }), false);
  assert.equal(courseColor("", "พีชคณิต"), courseColor("", "พีชคณิต"));
});
test("saved empty timetable means free, missing timetable stays unknown, term and Bangkok boundaries remain exact", () => {
  const f: Friend = { id: randomUUID(), nickname: "Fixture", thaiName: "", department: "", initials: "F", avatar: 0, semester: { name: "1", start: "2026-08-01", end: "2026-12-31" }, sessions: [], published: true, timetable: { revision: 1, updatedAt: null, storageReady: true } };
  const now = new Date("2026-10-23T01:45:00Z");
  assert.equal(getAvailability(f, now).kind, "free");
  assert.equal(getAvailability({ ...f, published: false }, now).kind, "no-schedule");
  f.sessions = [{ ...base, id: randomUUID(), code: "", section: "", room: "", color: 0, day: 5 }];
  assert.equal(getAvailability(f, now).kind, "in-class");
  assert.equal(getAvailability(f, new Date("2026-10-23T10:15:00+07:00")).kind, "free");
  assert.equal(getAvailability(f, new Date("2027-01-01T09:00:00+07:00")).kind, "out-of-term");
  f.sessions.push({ ...f.sessions[0], id: randomUUID(), start: "09:00", end: "12:00" });
  assert.ok(placeOverlaps(f.sessions).every(p => p.lanes === 2));
  const html = renderToStaticMarkup(createElement(ClockProvider, null, createElement(WeeklyTimetable, { friend: f })));
  assert.ok(html.includes("08:45") && html.includes("12:00") && html.includes("Linear Algebra"));
  assert.ok(!html.includes("API unavailable"));
});
