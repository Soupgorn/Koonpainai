import { test } from "node:test";
import assert from "node:assert/strict";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  normalizeText,
  parseDay,
  parseKmitlTimetable,
  parseTimeRanges,
} from "../src/lib/pdf/kmitl-parser";
import { scheduleExportSchema, toScheduleExport } from "../src/lib/pdf/schema";
import { getAvailability } from "../src/lib/schedule";
import {
  positionedFixture,
  scanPdfFixture,
  textPdfFixture,
} from "./fixtures/pdf-fixtures";

test("a real text PDF exposes a text layer with course positions", async () => {
  const loading = getDocument({ data: await textPdfFixture() });
  const doc = await loading.promise;
  try {
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const words = content.items.filter((item) => "str" in item);
    assert.ok(words.some((item) => item.str === "01000001"));
    assert.ok(words.every((item) => item.transform.length === 6));
  } finally {
    await loading.destroy();
  }
});
test("a scanned PDF contains images and no embedded text layer", async () => {
  const loading = getDocument({ data: await scanPdfFixture({ thai: true }) });
  const doc = await loading.promise;
  try {
    const content = await (await doc.getPage(1)).getTextContent();
    assert.equal(content.items.length, 0);
  } finally {
    await loading.destroy();
  }
});
test("detailed row parsing preserves two Friday sessions and exact minutes", () => {
  const result = parseKmitlTimetable([positionedFixture()]);
  assert.equal(result.sessions.length, 9);
  assert.deepEqual(
    result.sessions
      .filter((session) => session.day === 5)
      .map(({ start, end }) => [start, end]),
    [
      ["08:45", "10:15"],
      ["10:30", "12:00"],
    ],
  );
  assert.equal(result.semester.name, "Semester 1 / 2026");
  assert.equal(result.semester.start, "");
});
test("distinct lecture/lab sections and rooms remain separate", () => {
  const result = parseKmitlTimetable([positionedFixture()]);
  assert.deepEqual(
    result.sessions
      .filter((session) => session.code === "01000004")
      .map(({ section, room, end }) => [section, room, end]),
    [
      ["101", "LAB-706", "12:00"],
      ["201", "LAB-707", "16:00"],
    ],
  );
  assert.equal(new Set(result.sessions.map((session) => session.id)).size, 9);
});
test("Thai days/digits and noisy separators normalize without inventing time values", () => {
  assert.equal(parseDay("พ ฤ หั ส บ ดี"), 4);
  assert.equal(parseDay("ศุกร์"), 5);
  assert.equal(parseDay("unreadable"), null);
  assert.equal(normalizeText("๐๘:๔๕"), "08:45");
  assert.deepEqual(
    parseTimeRanges("ศุกร์ 8 . 45 – 10 . 15").map(({ start, end }) => [
      start,
      end,
    ]),
    [["08:45", "10:15"]],
  );
  assert.equal(parseTimeRanges("08:?? - 12:00").length, 0);
});
test("missing/uncertain values stay empty and OCR confidence is never invented", () => {
  const page = positionedFixture();
  page.tokens = page.tokens.filter((token) => token.text !== "LAB-706");
  const result = parseKmitlTimetable([page]);
  const missing = result.sessions.find(
    (session) => session.code === "01000004" && session.section === "101",
  )!;
  assert.equal(missing.room, "");
  assert.equal(missing.source.confidence, undefined);
  assert.equal(scheduleExportSchema.safeParse({}).success, false);
});
test("low actual OCR confidence produces field warnings", () => {
  const page = positionedFixture();
  page.method = "ocr";
  page.tokens = page.tokens.map((token) => ({
    ...token,
    confidence: token.text === "LINEAR ALGEBRA" ? 45 : 96,
  }));
  const result = parseKmitlTimetable([page]);
  assert.ok(
    result.sessions[0].warnings.some((warning) => warning.field === "name"),
  );
});

test("wrapped course names and sessions on different days retain their row association", () => {
  const page = positionedFixture();
  const name = page.tokens.find(
    (token) => token.text === "PROBABILITY AND RANDOM VARIABLES",
  )!;
  page.tokens = page.tokens.filter((token) => token !== name);
  page.tokens.push(
    { ...name, text: "PROBABILITY AND", y: name.y - 4 },
    { ...name, text: "RANDOM VARIABLES", y: name.y + 8 },
  );
  const fridayTokens = page.tokens.filter((token) => token.text === "Friday");
  fridayTokens[0].text = "Monday";
  fridayTokens[1].text = "Thursday";
  const parsed = parseKmitlTimetable([page]);
  assert.equal(
    parsed.sessions.find((session) => session.code === "01000002")?.name,
    "PROBABILITY AND RANDOM VARIABLES",
  );
  assert.deepEqual(
    parsed.sessions
      .filter((session) => session.code === "01000001")
      .map((session) => session.day),
    [1, 4],
  );
});

test("unclear course-code characters and missing range separators require review", () => {
  const page = positionedFixture();
  page.tokens.find((token) => token.text === "01000001")!.text = "O1000001";
  page.tokens = page.tokens.filter((token) => token.text !== "-");
  const parsed = parseKmitlTimetable([page]);
  assert.equal(parsed.sessions.length, 9);
  assert.equal(parsed.sessions[0].code, "O1000001");
  assert.ok(
    parsed.sessions[0].warnings.some((warning) => warning.field === "code"),
  );
  assert.ok(
    parsed.sessions[0].warnings.some((warning) => warning.field === "start"),
  );
  assert.equal(parsed.sessions[0].start, "08:45");
});
test("canonical JSON validation blocks invalid times, days, term dates and missing confirmation data", () => {
  const result = parseKmitlTimetable([positionedFixture()]);
  const term = { name: "Term", start: "2026-08-03", end: "2026-12-13" };
  const exported = toScheduleExport("Fictional friend", term, result.sessions);
  assert.equal(scheduleExportSchema.safeParse(exported).success, true);
  assert.equal(
    scheduleExportSchema.safeParse({
      ...exported,
      sessions: [{ ...exported.sessions[0], start: "12:00", end: "09:00" }],
    }).success,
    false,
  );
  assert.equal(
    scheduleExportSchema.safeParse({
      ...exported,
      semester: { ...term, start: "2026-02-31" },
    }).success,
    false,
  );
  assert.equal(
    scheduleExportSchema.safeParse({
      ...exported,
      sessions: [{ ...exported.sessions[0], day: 8 }],
    }).success,
    false,
  );
  assert.equal(JSON.stringify(exported).includes("evidence"), false);
  assert.equal(JSON.stringify(exported).includes("Fictional lecturer"), false);
});
test("imported sessions work with Bangkok status boundaries", () => {
  const result = parseKmitlTimetable([positionedFixture()]);
  const approved = toScheduleExport(
    "Test",
    { name: "Term", start: "2026-08-03", end: "2026-12-13" },
    result.sessions,
  );
  const friend = {
    ...approved,
    id: "test",
    thaiName: "",
    initials: "T",
    avatar: 0,
    department: "Fixture",
    published: true,
  };
  assert.equal(
    getAvailability(friend, new Date("2026-10-23T08:45:00+07:00")).kind,
    "in-class",
  );
  assert.equal(
    getAvailability(friend, new Date("2026-10-23T10:15:00+07:00")).current
      .length,
    0,
  );
  assert.equal(
    getAvailability(friend, new Date("2026-10-23T10:30:00+07:00")).current[0]
      .start,
    "10:30",
  );
  assert.equal(
    getAvailability(friend, new Date("2027-01-01T09:00:00+07:00")).kind,
    "out-of-term",
  );
});
