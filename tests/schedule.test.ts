import { test } from "node:test";
import assert from "node:assert/strict";
import { friends } from "../src/lib/data";
import {
  getAvailability,
  localParts,
  nextLabel,
  placeOverlaps,
} from "../src/lib/schedule";
import {
  importErrors,
  sessionErrors,
  overlapCount,
} from "../src/lib/import-validation";
import type { ClassSession, Friend } from "../src/lib/types";
const bean = friends[0];
const at = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`);
test("uses Bangkok time even when the machine date differs", () => {
  assert.equal(localParts(new Date("2026-10-19T18:00:00Z")).date, "2026-10-20");
  assert.equal(localParts(new Date("2026-10-19T18:00:00Z")).day, 2);
  assert.equal(localParts(new Date("2026-10-19T18:00:00Z")).time, "01:00");
});
test("exact start is in class and exact end is free", () => {
  assert.equal(
    getAvailability(bean, at("2026-10-20", "09:00")).kind,
    "in-class",
  );
  assert.equal(
    getAvailability(bean, at("2026-10-20", "12:00")).current.length,
    0,
  );
  assert.equal(getAvailability(bean, at("2026-10-20", "16:00")).kind, "free");
});
test("one-minute-before-start is upcoming and points to the right class", () => {
  const state = getAvailability(bean, at("2026-10-20", "08:59"));
  assert.equal(state.kind, "upcoming");
  assert.equal(state.next?.session.id, "discrete");
});
test("finds afternoon class during the lunch break", () => {
  const state = getAvailability(bean, at("2026-10-20", "12:15"));
  assert.equal(state.kind, "upcoming");
  assert.equal(state.next?.session.id, "database");
});
test("minute-accurate Friday sessions respect the 15-minute break", () => {
  assert.equal(
    getAvailability(bean, at("2026-10-23", "08:45")).current[0].id,
    "linear-1",
  );
  assert.equal(
    getAvailability(bean, at("2026-10-23", "10:15")).current.length,
    0,
  );
  assert.equal(
    getAvailability(bean, at("2026-10-23", "10:30")).current[0].id,
    "linear-2",
  );
});
test("empty weekend finds Monday without declaring unavailable", () => {
  const state = getAvailability(bean, at("2026-10-25", "10:00"));
  assert.equal(state.kind, "free");
  assert.equal(state.next?.date, "2026-10-26");
  assert.equal(
    nextLabel(state.next!, at("2026-10-25", "10:00")),
    "Tomorrow, 09:00",
  );
});
test("no timetable is distinct from free", () => {
  assert.equal(
    getAvailability(friends.at(-1)!, at("2026-10-20", "09:30")).kind,
    "no-schedule",
  );
});
test("draft schedules do not imply public availability", () => {
  assert.equal(
    getAvailability({ ...bean, published: false }, at("2026-10-20", "09:30"))
      .kind,
    "no-schedule",
  );
});
test("outside semester is not in class, and next class respects future semester start", () => {
  const before = getAvailability(bean, at("2026-07-01", "10:00"));
  assert.equal(before.kind, "out-of-term");
  assert.equal(before.next?.date, "2026-08-03");
  const after = getAvailability(bean, at("2026-12-14", "10:00"));
  assert.equal(after.kind, "out-of-term");
  assert.equal(after.next, null);
});
test("semester end date is inclusive", () => {
  const ending: Friend = {
    ...bean,
    semester: { ...bean.semester, end: "2026-10-20" },
  };
  assert.equal(
    getAvailability(ending, at("2026-10-20", "10:00")).kind,
    "in-class",
  );
  assert.equal(getAvailability(ending, at("2026-10-21", "10:00")).next, null);
});
test("reports all ongoing overlaps and their real next break", () => {
  const oak = friends.find((f) => f.id === "oak")!;
  const state = getAvailability(oak, at("2026-10-20", "10:45"));
  assert.equal(state.current.length, 2);
  assert.equal(state.freeAt, "12:00");
});
test("free-at follows a transitive chain of overlapping and adjacent classes", () => {
  const make = (id: string, start: string, end: string): ClassSession => ({
    ...bean.sessions[0],
    id,
    day: 2,
    start,
    end,
  });
  const f = {
    ...bean,
    sessions: [
      make("a", "09:00", "10:00"),
      make("b", "09:30", "11:00"),
      make("c", "10:30", "12:00"),
      make("d", "12:00", "13:00"),
    ],
  };
  assert.equal(getAvailability(f, at("2026-10-20", "09:15")).freeAt, "13:00");
});
test("overlap layout assigns separate lanes and reclaims lanes for later classes", () => {
  const base = bean.sessions[0];
  const placed = placeOverlaps([
    { ...base, id: "a", start: "09:00", end: "12:00" },
    { ...base, id: "b", start: "10:00", end: "11:00" },
    { ...base, id: "c", start: "11:00", end: "12:00" },
    { ...base, id: "d", start: "13:00", end: "16:00" },
  ]);
  assert.deepEqual(
    placed.map((p) => [p.session.id, p.lane, p.lanes]),
    [
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 1, 2],
      ["d", 0, 1],
    ],
  );
});
test("import validation catches missing rooms and reversed times", () => {
  const invalid = {
    ...bean.sessions[0],
    room: "",
    start: "12:00",
    end: "09:00",
  };
  assert.deepEqual(sessionErrors(invalid), [
    "Add a classroom.",
    "End time must be after start time.",
  ]);
});
test("import validation rejects invalid dates and empty schedules", () => {
  assert.ok(
    importErrors(
      "Bean",
      { ...bean.semester, start: "2026-02-31" },
      bean.sessions,
    ).includes("Choose valid semester dates."),
  );
  assert.ok(
    importErrors("", bean.semester, []).includes("Add your friend’s nickname."),
  );
  assert.ok(
    importErrors("Bean", bean.semester, []).includes("Add at least one class."),
  );
});
test("realistically complete sample validates and overlap detection is day-aware", () => {
  assert.deepEqual(importErrors("Bean", bean.semester, bean.sessions), []);
  assert.equal(overlapCount(bean.sessions), 0);
  assert.equal(overlapCount(friends.find((f) => f.id === "oak")!.sessions), 1);
});
