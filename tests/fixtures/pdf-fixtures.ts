import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { resolve } from "node:path";
import type { ExtractedPage, TextToken } from "../../src/lib/pdf/types";

// Authored fixtures. Never derived from a real student's PDF or identifiers.
export const fictionalRows = [
  {
    code: "01000001",
    name: "LINEAR ALGEBRA",
    section: "101",
    room: "TEST-305",
    times: ["Friday 08:45 - 10:15", "Friday 10:30 - 12:00"],
  },
  {
    code: "01000002",
    name: "PROBABILITY AND RANDOM VARIABLES",
    section: "101",
    room: "TEST-609",
    times: ["Wednesday 09:00 - 12:00"],
  },
  {
    code: "01000003",
    name: "DISCRETE MATHEMATICS",
    section: "101",
    room: "TEST-609",
    times: ["Tuesday 09:00 - 12:00"],
  },
  {
    code: "01000004",
    name: "DATA STRUCTURES AND ALGORITHMS",
    section: "101",
    room: "LAB-706",
    times: ["Monday 09:00 - 12:00"],
  },
  {
    code: "01000004",
    name: "DATA STRUCTURES AND ALGORITHMS",
    section: "201",
    room: "LAB-707",
    times: ["Monday 13:00 - 16:00"],
  },
  {
    code: "01000005",
    name: "COMPUTER NETWORKS",
    section: "101",
    room: "TEST-609",
    times: ["Thursday 09:00 - 12:00"],
  },
  {
    code: "01000005",
    name: "COMPUTER NETWORKS",
    section: "201",
    room: "LAB-608",
    times: ["Thursday 13:00 - 16:00"],
  },
  {
    code: "01000006",
    name: "DATABASE SYSTEMS",
    section: "101",
    room: "LAB-610",
    times: ["Tuesday 13:00 - 16:00"],
  },
];
export function fixtureTokens(): TextToken[] {
  const tokens: TextToken[] = [];
  const add = (text: string, x: number, y: number, width?: number) =>
    tokens.push({ text, x, y, width: width ?? text.length * 4, height: 9 });
  add("Fictional timetable / Semester 1 / 2026", 30, 45);
  [
    ["Course code", 30],
    ["Course name", 104],
    ["Section", 335],
    ["Day / time", 385],
    ["Room", 545],
    ["Instructor", 710],
  ].forEach(([text, x]) => add(String(text), Number(x), 110));
  let top = 145;
  fictionalRows.forEach((row) => {
    const offset = row.times.length > 1 ? 14 : 6;
    add(row.code, 30, top + offset, 34);
    add(row.name, 104, top + offset, Math.min(210, row.name.length * 4));
    add(row.section, 335, top + offset, 14);
    add(row.room, 545, top + offset, 45);
    add("Fictional lecturer", 710, top + offset, 70);
    row.times.forEach((time, index) => {
      const [day, start, dash, end] = time.split(" ");
      add(day, 385, top + index * 18 + 3, day.length * 4);
      add(start, 442, top + index * 18 + 3, 22);
      add(dash, 468, top + index * 18 + 3, 3);
      add(end, 475, top + index * 18 + 3, 22);
    });
    top += row.times.length > 1 ? 48 : 34;
  });
  return tokens;
}
export function positionedFixture(): ExtractedPage {
  const tokens = fixtureTokens();
  return {
    page: 2,
    width: 842,
    height: 595,
    method: "text",
    tokens,
    text: tokens.map((token) => token.text).join(" "),
  };
}
export async function textPdfFixture(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([842, 595]);
  for (const token of fixtureTokens())
    page.drawText(token.text, {
      x: token.x,
      y: 595 - token.y - 9,
      size: 8,
      font,
      color: rgb(0, 0, 0),
    });
  doc.setTitle("Sanitized fictional Koonpinai timetable");
  return doc.save();
}
export async function scanPdfFixture({
  mixed = false,
  thai = false,
} = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  if (mixed) {
    const cover = doc.addPage([842, 595]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let line = 0; line < 6; line++)
      cover.drawText(
        "Fictional supporting page. This page has readable embedded text and no course records.",
        { x: 30, y: 530 - line * 25, size: 11, font },
      );
  }
  const scale = 3;
  const canvas = createCanvas(842 * scale, 595 * scale);
  const context = canvas.getContext("2d");
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(scale, scale);
  context.fillStyle = "black";
  GlobalFonts.registerFromPath(
    resolve(
      "node_modules/@fontsource-variable/noto-sans-thai/files/noto-sans-thai-thai-wght-normal.woff2",
    ),
    "FixtureThai",
  );
  const thaiDays: Record<string, string> = {
    Monday: "จันทร์",
    Tuesday: "อังคาร",
    Wednesday: "พุธ",
    Thursday: "พฤหัสบดี",
    Friday: "ศุกร์",
  };
  for (const token of fixtureTokens()) {
    const isThai = thai && token.text in thaiDays;
    context.font = isThai ? "8px FixtureThai" : "8px Arial";
    context.fillText(
      isThai ? thaiDays[token.text] : token.text,
      token.x,
      token.y + 9,
    );
  }
  const image = await doc.embedPng(canvas.toBuffer("image/png"));
  const page = doc.addPage([842, 595]);
  page.drawImage(image, { x: 0, y: 0, width: 842, height: 595 });
  canvas.width = canvas.height = 0;
  return doc.save();
}
