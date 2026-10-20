"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  Download,
  FileText,
  FileUp,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Square,
  X,
} from "lucide-react";
import type { Friend, Semester } from "@/lib/types";
import { overlapCount } from "@/lib/import-validation";
import { PDF_LIMITS, validatePdfFile } from "@/lib/pdf/config";
import { scheduleExportSchema, toScheduleExport } from "@/lib/pdf/schema";
import type {
  DraftSession,
  ParsedTimetable,
  ProcessingProgress,
} from "@/lib/pdf/types";
import { Button } from "./ui/button";
import { PdfPreview } from "./pdf-preview";
import { ImportReviewEditor } from "./import-review-editor";
import { WeeklyTimetable } from "./weekly-timetable";
import { FriendProfile } from "./friend-profile";

const STEPS = ["Upload", "Extract", "Review", "Export"];
const EMPTY_TERM: Semester = { name: "", start: "", end: "" };
const STAGES: Record<ProcessingProgress["stage"], string> = {
  opening: "Opening your PDF",
  "detecting-text": "Checking for embedded text",
  rendering: "Preparing this page for OCR",
  "loading-ocr": "Loading the local Thai and English OCR engine",
  recognizing: "Reading Thai and English text",
  parsing: "Reconstructing course rows and sessions",
};
export function ImportWorkflow({ personal = false, onUsePreview }: { personal?: boolean; onUsePreview?: (friend: Friend) => void } = {}) {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [validating, setValidating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [result, setResult] = useState<ParsedTimetable | null>(null);
  const [sessions, setSessions] = useState<DraftSession[]>([]);
  const [nickname, setNickname] = useState("");
  const [semester, setSemester] = useState<Semester>(EMPTY_TERM);
  const [confirmed, setConfirmed] = useState(false);
  const [sourcePage, setSourcePage] = useState(1);
  const [preview, setPreview] = useState<"week" | "profile">("week");
  const [notice, setNotice] = useState("");
  const [mobilePanel, setMobilePanel] = useState<"review" | "source">("review");
  const picker = useRef<HTMLInputElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const activeUrl = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const selection = useRef(0);
  useEffect(
    () => () => {
      selection.current++;
      controller.current?.abort();
      if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
    },
    [],
  );
  const schema = scheduleExportSchema.safeParse({
    schemaVersion: 1,
    timeZone: "Asia/Bangkok",
    weekdayConvention:
      "0=Sunday,1=Monday,2=Tuesday,3=Wednesday,4=Thursday,5=Friday,6=Saturday",
    nickname,
    semester,
    sessions,
  });
  const errors = schema.success
    ? []
    : schema.error.issues.map((issue) =>
        issue.path.includes("day")
          ? "Choose a day for every session."
          : issue.message,
      );
  const uncertain = sessions.filter(
    (session) => session.warnings.length,
  ).length;
  const overlaps = overlapCount(
    sessions.filter(
      (
        session,
      ): session is DraftSession & { day: NonNullable<DraftSession["day"]> } =>
        session.day !== null,
    ),
  );
  const previewFriend: Friend | null = schema.success
    ? {
        id: "private-import-preview",
        nickname: schema.data.nickname,
        thaiName: "",
        initials: schema.data.nickname[0]?.toUpperCase() || "?",
        avatar: 0,
        department: "Imported timetable",
        semester: schema.data.semester,
        sessions: schema.data.sessions,
        published: true,
      }
    : null;
  function go(next: number) {
    setError("");
    setNotice("");
    setStep(next);
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => title.current?.focus());
  }
  function cancel() {
    controller.current?.abort();
    controller.current = null;
    setProcessing(false);
    setProgress(null);
    setError(
      "Processing cancelled. No schedule was accepted. You can try again or replace the file.",
    );
  }
  function removeFile() {
    selection.current++;
    controller.current?.abort();
    controller.current = null;
    if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
    activeUrl.current = null;
    setUrl(null);
    setFile(null);
    setResult(null);
    setSessions([]);
    setSemester(EMPTY_TERM);
    setNickname("");
    setConfirmed(false);
    setProcessing(false);
    setProgress(null);
    setError("");
    setStep(0);
  }
  async function chooseFile(candidate?: File) {
    if (!candidate) return;
    const current = ++selection.current;
    setValidating(true);
    setError("");
    try {
      await validatePdfFile(candidate);
      if (current !== selection.current) return;
      controller.current?.abort();
      controller.current = null;
      if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
      const nextUrl = URL.createObjectURL(candidate);
      activeUrl.current = nextUrl;
      setUrl(nextUrl);
      setFile(candidate);
      setResult(null);
      setSessions([]);
      setNickname("");
      setSemester(EMPTY_TERM);
      setConfirmed(false);
      setProcessing(false);
      setProgress(null);
      setSourcePage(1);
      setStep(0);
      setNotice("");
    } catch (caught) {
      if (current === selection.current)
        setError(
          caught instanceof Error
            ? caught.message
            : "The file could not be read. Select it again.",
        );
    } finally {
      if (current === selection.current) setValidating(false);
      if (picker.current) picker.current.value = "";
    }
  }
  async function extract() {
    if (!file || controller.current) return;
    const job = new AbortController();
    controller.current = job;
    setProcessing(true);
    setResult(null);
    setSessions([]);
    setConfirmed(false);
    setError("");
    setStep(1);
    setProgress({ stage: "opening", page: 0, total: 0 });
    try {
      const { processPdf } = await import("@/lib/pdf/process-pdf");
      const parsed = await processPdf(file, {
        signal: job.signal,
        onProgress: (next) => {
          if (controller.current === job) setProgress(next);
        },
      });
      if (job.signal.aborted || controller.current !== job) return;
      setResult(parsed);
      setSessions(parsed.sessions);
      setSemester(parsed.semester);
      setSourcePage(parsed.sessions[0]?.source.page || 1);
      if (!parsed.sessions.length) {
        setError(
          "No reliable course records were recognized. Nothing was accepted. Try another export or compare the PDF and enter sessions manually.",
        );
        return;
      }
      go(2);
    } catch (caught) {
      if (controller.current !== job) return;
      setError(
        caught instanceof DOMException && caught.name === "AbortError"
          ? "Processing cancelled. No schedule was accepted."
          : caught instanceof Error
            ? caught.message
            : "Extraction failed. Export a new PDF and try again.",
      );
    } finally {
      if (controller.current === job) {
        controller.current = null;
        setProcessing(false);
        setProgress(null);
      }
    }
  }
  function changeSessions(next: DraftSession[]) {
    setSessions(next);
    setConfirmed(false);
  }
  function showSource(page: number) {
    setSourcePage(page);
    setMobilePanel("source");
    if (window.innerWidth <= 900)
      requestAnimationFrame(() => document.getElementById("pdf-source")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      }));
  }
  function accept() {
    if (!confirmed || !schema.success) {
      setError(
        "Correct the required fields and confirm you have checked the schedule against the PDF.",
      );
      return;
    }
    go(3);
  }
  function download() {
    try {
      if (!confirmed)
        throw new Error("Confirm the reviewed schedule before exporting.");
      const approved = toScheduleExport(nickname, semester, sessions);
      const blob = new Blob([JSON.stringify(approved, null, 2)], {
        type: "application/json",
      });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `koonpinai-${
        nickname
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, "-")
          .slice(0, 40) || "timetable"
      }.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setNotice(
        "JSON download started. This timetable is still private and has not been saved to a server.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The schedule could not be exported. Return to review and check the fields.",
      );
    }
  }
  return (
    <main id="main" className="main-container import-page">
      <Link className="back-link" href={personal ? "/my-timetable" : "/admin"}>
        <ArrowLeft size={15} />
        {personal ? "My Timetable" : "Manage timetables"}
      </Link>
      <div className="import-heading">
        <h1 ref={title} tabIndex={-1}>
          Bring your week along.
        </h1>
        <p>Read your PDF. Check the details. Make room for plans.</p>
      </div>
      <div className="import-demo-banner privacy-banner">
        <LockKeyhole size={18} />
        <div>
          <strong>Your PDF stays in your browser.</strong>
          <p>
            PDF reading and Thai/English OCR run on your device. Review and
            export a private schedule; public publishing is not connected.
          </p>
        </div>
      </div>
      <ol className="import-steps" aria-label="Import progress">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={`${step === index ? "step-current" : ""} ${step > index ? "step-complete" : ""}`}
            aria-current={step === index ? "step" : undefined}
          >
            <span>{step > index ? <Check size={15} /> : index + 1}</span>
            <strong>{label}</strong>
            {index < 3 && <ChevronRight size={15} />}
          </li>
        ))}
      </ol>
      {error && (
        <p className="form-error" role="alert">
          <AlertCircle size={16} />
          {error}
        </p>
      )}
      <input
        type="file"
        ref={picker}
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose timetable PDF"
        onChange={(event) => void chooseFile(event.target.files?.[0])}
      />
      {step === 0 && (
        <section className="upload-step">
          <div className="step-heading">
            <h2>Start with your timetable.</h2>
            <p>
              Choose the PDF exported from KMITL. Text and scanned pages are
              supported.
            </p>
          </div>
          <div
            className={`dropzone ${drag ? "is-dragging" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setDrag(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDragLeave={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              )
                setDrag(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDrag(false);
              if (event.dataTransfer.files.length !== 1) {
                setError("Choose one PDF at a time.");
                return;
              }
              void chooseFile(event.dataTransfer.files[0]);
            }}
          >
            <div className="upload-symbol">
              <FileUp size={29} strokeWidth={1.4} />
            </div>
            <h3>
              {drag
                ? "Drop your PDF here"
                : file
                  ? "Your week is ready to read."
                  : "Bring your week along."}
            </h3>
            <p>Drag a timetable here, or choose a file.</p>
            <Button
              variant="outline"
              disabled={validating}
              onClick={() => picker.current?.click()}
            >
              {validating
                ? "Checking file…"
                : file
                  ? "Replace PDF"
                  : "Choose PDF"}
            </Button>
            <span>
              PDF only, up to {Math.round(PDF_LIMITS.maxBytes / 1024 / 1024)} MB
              / {PDF_LIMITS.maxPages} pages
            </span>
          </div>
          {file && (
            <div className="selected-file">
              <FileText size={22} />
              <div>
                <strong>{file.name}</strong>
                <span>{(file.size / 1024).toFixed(1)} KB / Local file</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove selected PDF"
                onClick={removeFile}
              >
                <X size={17} />
              </Button>
            </div>
          )}
          <div className="upload-actions">
            <Button
              disabled={!file || validating}
              onClick={() => void extract()}
            >
              Read timetable
              <ArrowRight size={15} />
            </Button>
          </div>
          <p className="upload-footnote">
            No upload, no account connection, no automatic publishing.
          </p>
        </section>
      )}
      {step === 1 && (
        <section className="prepare-step">
          <div className="prepare-icon">
            <FileText size={34} strokeWidth={1.3} />
          </div>
          <h2>
            {processing
              ? "Making sense of your week."
              : "Let’s take another look."}
          </h2>
          <p>
            {processing
              ? "Each page is checked for text. Scanned pages are read with Thai and English OCR. Keep this tab open while it works."
              : "A failed or cancelled extraction is never treated as an imported schedule."}
          </p>
          {processing && progress && (
            <div className="processing-status" role="status" aria-live="polite">
              <strong>{STAGES[progress.stage]}</strong>
              <span>
                {progress.total
                  ? `Page ${progress.page || 1} of ${progress.total}`
                  : "Opening the document"}
              </span>
              {progress.fraction !== undefined && (
                <>
                  <progress
                    value={progress.fraction}
                    max={1}
                    aria-label={`OCR progress for page ${progress.page}`}
                  />
                  <span>
                    {Math.round(progress.fraction * 100)}% of this page
                  </span>
                </>
              )}
            </div>
          )}
          <div className="step-actions">
            {processing ? (
              <Button variant="outline" onClick={cancel}>
                <Square size={14} />
                Cancel processing
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => go(0)}>
                  Replace PDF
                </Button>
                <Button onClick={() => void extract()}>
                  <RefreshCw size={15} />
                  Try extraction again
                </Button>
              </>
            )}
          </div>
          {!processing && result && !result.sessions.length && (
            <Button variant="ghost" onClick={() => go(2)}>
              Review PDF and enter sessions manually
            </Button>
          )}
        </section>
      )}
      {step === 2 && file && (
        <section className="review-step">
          <div className="section-heading">
            <div>
              <h2>Your week deserves a second look.</h2>
              <p>
                Check the extracted fields against the original PDF. Nothing has
                been accepted yet.
              </p>
            </div>
            <span
              className={`validation-count ${errors.length || uncertain ? "needs-review" : "is-valid"}`}
            >
              {errors.length || uncertain ? (
                <AlertCircle size={15} />
              ) : (
                <CheckCheck size={15} />
              )}
              {errors.length
                ? `${errors.length} required ${errors.length === 1 ? "correction" : "corrections"}`
                : uncertain
                  ? `${uncertain} ${uncertain === 1 ? "session needs" : "sessions need"} OCR review`
                  : "Required fields complete"}
            </span>
          </div>
          {result && (
            <div className="extraction-summary" aria-label="Extraction results">
              {result.pages.map((page) => (
                <span key={page.page}>
                  <Check size={14} />
                  Page {page.page}:{" "}
                  {page.method === "ocr"
                    ? "Thai + English OCR"
                    : "Embedded PDF text"}
                  {page.confidence !== undefined && (
                    <small>
                      {Math.round(page.confidence)}% page word confidence
                    </small>
                  )}
                </span>
              ))}
            </div>
          )}
          {result?.warnings.length ? (
            <details className="extraction-notes">
              <summary>
                <AlertCircle size={15} />
                Read extraction notes ({result.warnings.length})
              </summary>
              <ul>
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </details>
          ) : null}
          <div className="mobile-review-tabs" role="group" aria-label="Import review panels">
            <button aria-pressed={mobilePanel === "review"} onClick={() => setMobilePanel("review")}>Review classes ({sessions.length})</button>
            <button aria-pressed={mobilePanel === "source"} onClick={() => setMobilePanel("source")}>Original PDF</button>
          </div>
          <div className="review-layout" data-mobile-panel={mobilePanel}>
            <aside className="source-panel" id="pdf-source" tabIndex={-1}>
              <div className="source-panel-heading">
                <FileText size={16} />
                <strong>Original PDF</strong>
                {url && (
                  <a
                    className="text-link"
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open PDF
                  </a>
                )}
              </div>
              <PdfPreview
                key={file.lastModified + file.name}
                file={file}
                page={sourcePage}
                onPageChange={setSourcePage}
              />
              <p className="source-disclaimer">
                Select a session’s page reference to compare its source. OCR
                confidence helps prioritize review; it does not guarantee
                accuracy.
              </p>
            </aside>
            <ImportReviewEditor
              nickname={nickname}
              onNickname={(value) => {
                setNickname(value);
                setConfirmed(false);
              }}
              semester={semester}
              onSemester={(value) => {
                setSemester(value);
                setConfirmed(false);
              }}
              sessions={sessions}
              onSessions={changeSessions}
              onSourcePage={showSource}
            />
          </div>
          {overlaps > 0 && (
            <p className="form-warning">
              <AlertCircle size={16} />
              {overlaps} overlapping {overlaps === 1 ? "pair" : "pairs"}{" "}
              retained. Verify the times; the timetable displays overlaps side
              by side.
            </p>
          )}
          <label className="review-confirmation">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              I checked every session, section, classroom, and semester date
              against the PDF, including fields marked for review.
            </span>
          </label>
          <div className="review-bottom">
            <span aria-live="polite">
              {errors[0] ||
                (confirmed
                  ? "Reviewed and ready for a private preview."
                  : "Confirm your review before continuing.")}
            </span>
            <div className="step-actions">
              <Button variant="outline" onClick={() => go(0)}>
                Choose another PDF
              </Button>
              <Button disabled={!schema.success || !confirmed} onClick={accept}>
                Preview schedule
                <ArrowRight size={15} />
              </Button>
            </div>
          </div>
        </section>
      )}
      {step === 3 && previewFriend && (
        <section className="publish-step">
          <div className="section-heading">
            <div>
              <h2>{nickname}’s week, ready to use.</h2>
              <p>Private preview. The public directory has not changed.</p>
            </div>
            <Button variant="outline" onClick={() => go(2)}>
              Back to review
            </Button>
          </div>
          <div className="publish-summary">
            <span>
              <Check size={16} />
              {sessions.length} sessions reviewed
            </span>
            <span>
              <Check size={16} />
              {semester.name}
            </span>
            <span>
              <ShieldCheck size={16} />
              No server storage
            </span>
          </div>
          <div
            className="preview-tabs filter-tabs"
            role="group"
            aria-label="Schedule preview format"
          >
            <button
              aria-pressed={preview === "week"}
              onClick={() => setPreview("week")}
            >
              Weekly timetable
            </button>
            <button
              aria-pressed={preview === "profile"}
              onClick={() => setPreview("profile")}
            >
              Friend profile
            </button>
          </div>
          {preview === "week" ? (
            <WeeklyTimetable friend={previewFriend} />
          ) : (
            <FriendProfile friend={previewFriend} embedded sample={false} />
          )}
          <div className="publish-disclaimer">
            <div>
              <strong>A timetable to take with you.</strong>
              <p>
                Download validated JSON for Koonpinai. Reloading or leaving this
                page clears the import. GitHub storage and authenticated
                publishing will be added later.
              </p>
            </div>
            <Button onClick={download}>
              <Download size={16} />
              Download schedule JSON
            </Button>
          </div>
          {onUsePreview && <div className="personal-import-action"><Button onClick={() => { onUsePreview(previewFriend); setNotice("Timetable added to your temporary personal preview. It is not saved or shared and resets on reload."); }}>Use in my temporary preview</Button><Link className="text-link" href="/my-timetable">View My Timetable <ArrowRight size={15}/></Link></div>}
          <p className="export-notice" role="status">
            {notice}
          </p>
        </section>
      )}
    </main>
  );
}
