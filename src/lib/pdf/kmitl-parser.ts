import type { Day, Semester } from "../types";
import type {
  DraftSession,
  ExtractedPage,
  FieldWarning,
  ReviewField,
  TextToken,
  ParsedTimetable,
} from "./types";

export function normalizeText(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[๐-๙]/g, (digit) => String(digit.charCodeAt(0) - 0x0e50))
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[–—−]/g, "-")
    .replace(/([\u0e00-\u0e7f])\s+(?=[\u0e00-\u0e7f])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
const centerY = (token: TextToken) => token.y + token.height / 2;
const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
export function textLines(tokens: TextToken[], tolerance = 5): TextToken[][] {
  const lines: { center: number; words: TextToken[] }[] = [];
  for (const token of [...tokens].sort((a, b) => centerY(a) - centerY(b))) {
    let line = lines.find(
      (candidate) => Math.abs(candidate.center - centerY(token)) <= tolerance,
    );
    if (!line) {
      line = { center: centerY(token), words: [] };
      lines.push(line);
    }
    line.words.push(token);
  }
  return lines
    .sort((a, b) => a.center - b.center)
    .map((line) => line.words.sort((a, b) => a.x - b.x));
}
function cellText(tokens: TextToken[]) {
  return textLines(tokens)
    .map((line) => normalizeText(line.map((token) => token.text).join(" ")))
    .join(" ")
    .trim();
}
const dayAliases: [Day, RegExp][] = [
  [4, /พฤหัสบดี|พฤหัส|พฤ\.?|thursday|thu\b/i],
  [1, /จันทร์|จันท|จ\.|monday|mon\b/i],
  [2, /อังคาร|อังค|อ\.|tuesday|tue\b/i],
  [3, /พุธ|พ\.|wednesday|wed\b/i],
  [5, /ศุกร์|ศุก|ศ\.|friday|fri\b/i],
  [6, /เสาร์|เสาร|ส\.|saturday|sat\b/i],
  [0, /อาทิตย์|อาทิต|อา\.|sunday|sun\b/i],
];
export function parseDay(text: string): Day | null {
  const normalized = normalizeText(text);
  return (
    dayAliases.find(([, pattern]) => pattern.test(normalized))?.[0] ?? null
  );
}
export function parseTimeRanges(text: string) {
  const value = normalizeText(text).replace(/(\d)\s*[:.]\s*(\d)/g, "$1:$2");
  const range =
    /(\d{1,2}):([0-5]\d)(\s*(?:-|ถึง|to)\s*|\s+)(\d{1,2}):([0-5]\d)/gi;
  return Array.from(value.matchAll(range), (match) => ({
    start: `${match[1].padStart(2, "0")}:${match[2]}`,
    end: `${match[4].padStart(2, "0")}:${match[5]}`,
    before: value.slice(0, match.index),
    raw: match[0],
    uncertainSeparator: !/-|ถึง|to/i.test(match[3]),
  }));
}
function clusters(tokens: TextToken[], gap: number) {
  const groups: TextToken[][] = [];
  let right = -Infinity;
  for (const token of [...tokens].sort((a, b) => a.x - b.x)) {
    if (token.x - right > gap) groups.push([]);
    groups.at(-1)!.push(token);
    right = Math.max(right, token.x + token.width);
  }
  return groups;
}
function codeAnchors(page: ExtractedPage) {
  return page.tokens.filter(
    (token) =>
      /^[0-9OIl]{7,9}$/i.test(normalizeText(token.text)) &&
      token.x < page.width * 0.18 &&
      token.y > page.height * 0.08,
  );
}
function detailedAnchors(page: ExtractedPage) {
  const candidates = codeAnchors(page);
  const groups: TextToken[][] = [];
  for (const token of candidates) {
    let group = groups.find(
      (g) => Math.abs(g[0].x - token.x) < page.width * 0.025,
    );
    if (!group) {
      group = [];
      groups.push(group);
    }
    group.push(token);
  }
  const best = groups.sort((a, b) => b.length - a.length)[0] ?? [];
  const header = normalizeText(page.text).replace(/\s/g, "");
  const hasHeader = /รหัสวิชา|coursecode|subjectcode/i.test(header);
  if (best.length < 2 && !hasHeader) return [];
  // Visual grids repeat codes inside day cells; they are not detailed table rows.
  if (
    !hasHeader &&
    best.length &&
    median(best.map((token) => token.x)) > page.width * 0.12
  )
    return [];
  if (!page.tokens.some((token) => /\d{1,2}[:.]\d{2}/.test(token.text)))
    return [];
  return best.sort((a, b) => centerY(a) - centerY(b));
}
function courseColor(code: string) {
  return [...code].reduce((total, digit) => total + digit.charCodeAt(0), 0) % 6;
}
function confidence(tokens: TextToken[]) {
  const scores = tokens.flatMap((token) =>
    token.confidence === undefined ? [] : [token.confidence],
  );
  return scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : undefined;
}
function warnIfUncertain(
  field: ReviewField,
  tokens: TextToken[],
  warnings: FieldWarning[],
) {
  const actual = confidence(tokens);
  if (actual !== undefined && actual < 80)
    warnings.push({
      field,
      message: `${field}: OCR confidence is ${actual}%. Compare with the PDF.`,
    });
}
function parseDetailed(
  page: ExtractedPage,
  anchors: TextToken[],
): DraftSession[] {
  const codeX = median(anchors.map((token) => token.x));
  const gap =
    median(
      anchors.slice(1).map((token, i) => centerY(token) - centerY(anchors[i])),
    ) || 28;
  const bands = anchors.map((anchor, index) => {
    const top = index
      ? (centerY(anchors[index - 1]) + centerY(anchor)) / 2
      : centerY(anchor) - gap * 0.7;
    const bottom =
      index < anchors.length - 1
        ? (centerY(anchor) + centerY(anchors[index + 1])) / 2
        : centerY(anchor) + gap * 0.7;
    return page.tokens.filter(
      (token) => centerY(token) >= top && centerY(token) < bottom,
    );
  });
  const numeric = bands
    .flat()
    .filter(
      (token) =>
        /^\d{1,4}$/.test(normalizeText(token.text)) &&
        token.x > codeX + page.width * 0.15 &&
        token.x < page.width * 0.65,
    );
  const numberGroups: TextToken[][] = [];
  for (const token of numeric) {
    let group = numberGroups.find((g) => Math.abs(g[0].x - token.x) < 8);
    if (!group) {
      group = [];
      numberGroups.push(group);
    }
    group.push(token);
  }
  const sectionTokens =
    numberGroups.sort((a, b) => b.length - a.length || a[0].x - b[0].x)[0] ??
    [];
  const sectionX = sectionTokens.length
    ? median(sectionTokens.map((token) => token.x))
    : page.width * 0.398;
  const timeWords = bands
    .flat()
    .filter(
      (token) =>
        /\d{1,2}\s*[:.]\s*\d{2}/.test(normalizeText(token.text)) &&
        token.x > sectionX,
    );
  const firstTimeX = timeWords.length
    ? Math.min(...timeWords.map((token) => token.x))
    : page.width * 0.49;
  const between = bands
    .flat()
    .filter((token) => token.x > sectionX + 20 && token.x < firstTimeX - 2);
  const dayX = between.length
    ? Math.min(...between.map((token) => token.x))
    : firstTimeX - 35;
  const rooms = bands
    .flat()
    .filter(
      (token) =>
        /^(?:[A-Z]{1,8}[-]?\d{2,4}|\d{3,4}(?:\(|$))/.test(
          normalizeText(token.text),
        ) && token.x > firstTimeX + 55,
    );
  const roomX = rooms.length
    ? Math.min(...rooms.map((token) => token.x))
    : page.width * 0.618;
  const afterRoom = bands
    .flatMap((band) =>
      clusters(band, 16).map((group) =>
        Math.min(...group.map((token) => token.x)),
      ),
    )
    .filter((x) => x > roomX + 70);
  const instructorX = afterRoom.length ? Math.min(...afterRoom) : page.width;
  return bands.flatMap((band, rowIndex) => {
    const anchor = anchors[rowIndex];
    const nameTokens = band.filter(
      (token) =>
        token.x > anchor.x + anchor.width + 6 && token.x < sectionX - 6,
    );
    const groupTokens = band.filter(
      (token) => token.x >= sectionX - 6 && token.x < dayX - 5,
    );
    const whenTokens = band.filter(
      (token) => token.x >= dayX - 5 && token.x < roomX - 5,
    );
    const roomTokens = band.filter(
      (token) => token.x >= roomX - 5 && token.x < instructorX - 6,
    );
    const whenLines = textLines(whenTokens, 5).map((line) => ({
      text: cellText(line),
      tokens: line,
    }));
    let inheritedDay: Day | null = null;
    const slots = whenLines.flatMap((line) => {
      const declaredDay = parseDay(line.text);
      if (declaredDay !== null) inheritedDay = declaredDay;
      return parseTimeRanges(line.text).map((range) => ({
        ...range,
        day: parseDay(range.before) ?? inheritedDay,
        tokens: line.tokens,
      }));
    });
    if (!slots.length)
      slots.push({
        start: "",
        end: "",
        before: "",
        raw: "",
        uncertainSeparator: false,
        day: parseDay(cellText(whenTokens)),
        tokens: whenTokens,
      });
    const sections = textLines(groupTokens).map(cellText).filter(Boolean);
    const roomLines = textLines(roomTokens).map(cellText).filter(Boolean);
    return slots.map((slot, index): DraftSession => {
      const warnings: FieldWarning[] = [];
      if (!/^\d{8}$/.test(normalizeText(anchor.text)))
        warnings.push({
          field: "code",
          message:
            "The course code contains missing or uncertain characters. Check all eight digits in the PDF.",
        });
      if (slot.uncertainSeparator) {
        warnings.push({
          field: "start",
          message:
            "The range separator was not read. Verify both times against the PDF.",
        });
        warnings.push({
          field: "end",
          message:
            "The range separator was not read. Verify both times against the PDF.",
        });
      }
      const room = normalizeText(
        roomLines.length === slots.length
          ? roomLines[index]
          : roomLines.join(" "),
      ).replace(/([\u0e00-\u0e7f])\s+(-\d)/g, "$1$2");
      const section =
        sections.length === slots.length
          ? sections[index]
          : sections.length === 1
            ? sections[0]
            : "";
      if (sections.length > 1 && sections.length !== slots.length)
        warnings.push({
          field: "section",
          message:
            "Multiple sections cannot be aligned reliably. Choose the section shown for this session.",
        });
      if (slot.day === null)
        warnings.push({
          field: "day",
          message: "The weekday could not be read. Choose it from the PDF.",
        });
      for (const [field, tokens] of [
        ["code", [anchor]],
        ["name", nameTokens],
        ["section", groupTokens],
        ["day", slot.tokens],
        ["room", roomTokens],
        ["start", slot.tokens],
        ["end", slot.tokens],
      ] as [ReviewField, TextToken[]][])
        warnIfUncertain(field, tokens, warnings);
      return {
        id: `page-${page.page}-row-${rowIndex + 1}-session-${index + 1}`,
        code: normalizeText(anchor.text),
        name: cellText(nameTokens),
        section,
        day: slot.day,
        start: slot.start,
        end: slot.end,
        room,
        color: courseColor(anchor.text),
        source: {
          page: page.page,
          method: page.method,
          row: rowIndex + 1,
          confidence: confidence([
            ...nameTokens,
            ...groupTokens,
            ...slot.tokens,
            ...roomTokens,
          ]),
        },
        warnings,
        evidence: `${cellText(nameTokens)} / ${slot.day === null ? "day unclear" : slot.day} ${slot.start}-${slot.end}`,
      };
    });
  });
}
function termMetadata(pages: ExtractedPage[]): Semester {
  const text = normalizeText(pages.map((page) => page.text).join(" "));
  const thai = text.match(
    /ภาคการศึกษา\s*:?\s*([123])\s*[/\\]\s*(25\d{2}|20\d{2})/,
  );
  const english = text.match(
    /(?:semester|term)\s*:?\s*([123])\s*[/\\-]\s*(20\d{2}|25\d{2})/i,
  );
  const match = thai ?? english;
  return {
    name: match
      ? `Semester ${match[1]} / ${Number(match[2]) > 2400 ? Number(match[2]) - 543 : match[2]}`
      : "",
    start: "",
    end: "",
  };
}
export function parseKmitlTimetable(pages: ExtractedPage[]): ParsedTimetable {
  const detailed = pages
    .map((page) => ({ page, anchors: detailedAnchors(page) }))
    .filter((item) => item.anchors.length);
  const sessions = detailed.flatMap(({ page, anchors }) =>
    parseDetailed(page, anchors),
  );
  const warnings = [
    "Academic start and end dates must be confirmed; they are never inferred from a weekly timetable.",
  ];
  if (pages.some((page) => page.method === "ocr"))
    warnings.push(
      "OCR was used. Check every field against the original PDF; confidence does not guarantee correctness.",
    );
  const visual = pages.filter(
    (page) => !detailed.some((item) => item.page.page === page.page),
  );
  if (detailed.length && visual.length) {
    const codes = new Set(sessions.map((session) => session.code));
    const missing = [
      ...new Set(
        visual.flatMap((page) =>
          page.tokens
            .filter(
              (token) =>
                /^\d{8}$/.test(token.text) && token.y > page.height * 0.2,
            )
            .map((token) => token.text),
        ),
      ),
    ].filter((code) => !codes.has(code));
    if (missing.length)
      warnings.push(
        `${missing.length} course code(s) on other pages were not found in the detailed rows. Add any missing sessions before accepting.`,
      );
  }
  if (!sessions.length)
    warnings.push(
      "No reliable detailed course rows were found. The document has not been accepted. You can enter sessions manually while comparing the PDF.",
    );
  const seen = new Set<string>();
  for (const session of sessions) {
    const key = [
      session.code,
      session.section,
      session.day,
      session.start,
      session.end,
    ].join("|");
    if (seen.has(key))
      warnings.push(
        "Potential duplicate sessions were retained. Review and remove only confirmed duplicates.",
      );
    seen.add(key);
  }
  return {
    sessions,
    semester: termMetadata(pages),
    warnings: [...new Set(warnings)],
    pages: pages.map(({ page, method, confidence }) => ({
      page,
      method,
      confidence,
    })),
  };
}
