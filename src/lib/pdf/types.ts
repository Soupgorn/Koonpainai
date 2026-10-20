import type { ClassSession, Day, Semester } from "../types";

/** All boxes use PDF points, with the origin at the top-left of the page. */
export interface TextToken {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Actual OCR confidence, 0–100. Absent for embedded PDF text. */
  confidence?: number;
}
export interface ExtractedPage {
  page: number;
  width: number;
  height: number;
  method: "text" | "ocr";
  text: string;
  tokens: TextToken[];
  confidence?: number;
}
export type ReviewField =
  "code" | "name" | "section" | "day" | "start" | "end" | "room";
export interface FieldWarning {
  field: ReviewField;
  message: string;
}
export interface DraftSession extends Omit<ClassSession, "day"> {
  /** Same convention as the application: 0 Sunday, 1 Monday ... 6 Saturday. Null means unknown. */
  day: Day | null;
  source: {
    page: number;
    method: "text" | "ocr" | "manual";
    confidence?: number;
    row: number;
  };
  warnings: FieldWarning[];
  evidence: string;
}
export interface ParsedTimetable {
  sessions: DraftSession[];
  semester: Semester;
  warnings: string[];
  pages: Pick<ExtractedPage, "page" | "method" | "confidence">[];
}
export interface ProcessingProgress {
  stage:
    | "opening"
    | "detecting-text"
    | "rendering"
    | "loading-ocr"
    | "recognizing"
    | "parsing";
  page: number;
  total: number;
  /** Only a measured engine progress value. Missing when the engine cannot measure progress. */
  fraction?: number;
}
export interface ProcessingOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ProcessingProgress) => void;
  /** Defaults to 10 MiB; file size and resource limits are checked before parsing. */
  maxBytes?: number;
}
