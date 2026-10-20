"use client";
import { useState } from "react";
import {
  AlertCircle,
  ChevronRight,
  FileSearch,
  Plus,
  Trash2,
} from "lucide-react";
import { DAYS, WEEK_DAYS } from "@/lib/schedule";
import type { Day, Semester } from "@/lib/types";
import { classSessionSchema, draftErrors } from "@/lib/pdf/schema";
import type { DraftSession, ReviewField } from "@/lib/pdf/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface Props {
  nickname: string;
  onNickname: (value: string) => void;
  semester: Semester;
  onSemester: (value: Semester) => void;
  sessions: DraftSession[];
  onSessions: (value: DraftSession[]) => void;
  onSourcePage: (page: number) => void;
}
export function ImportReviewEditor({
  nickname,
  onNickname,
  semester,
  onSemester,
  sessions,
  onSessions,
  onSourcePage,
}: Props) {
  const [expanded, setExpanded] = useState(
    () =>
      new Set(
        sessions
          .filter(
            (session, index) =>
              index === 0 ||
              draftErrors(session).length ||
              session.warnings.length,
          )
          .map((session) => session.id),
      ),
  );
  function update(id: string, field: ReviewField, value: string | Day | null) {
    onSessions(
      sessions.map((session) =>
        session.id === id
          ? {
              ...session,
              [field]: value,
              warnings: session.warnings.filter(
                (warning) => warning.field !== field,
              ),
            }
          : session,
      ),
    );
  }
  function add() {
    const id = `manual-${crypto.randomUUID()}`;
    onSessions([
      ...sessions,
      {
        id,
        code: "",
        name: "",
        section: "",
        day: null,
        start: "",
        end: "",
        room: "",
        color: sessions.length % 6,
        source: { page: 0, row: 0, method: "manual" },
        warnings: [],
        evidence: "Manually entered by the reviewer.",
      },
    ]);
    setExpanded((previous) => new Set([...previous, id]));
  }
  return (
    <div className="review-editor">
      <div className="editor-section">
        <h3>Who’s this week for?</h3>
        <div className="form-grid">
          <label>
            Nickname
            <Input
              value={nickname}
              maxLength={40}
              required
              autoComplete="off"
              onChange={(event) => onNickname(event.target.value)}
              aria-invalid={!nickname.trim()}
            />
          </label>
          <label>
            Academic semester
            <Input
              value={semester.name}
              required
              onChange={(event) =>
                onSemester({ ...semester, name: event.target.value })
              }
              aria-invalid={!semester.name.trim()}
            />
          </label>
          <label>
            Semester starts
            <Input
              type="date"
              value={semester.start}
              required
              onChange={(event) =>
                onSemester({ ...semester, start: event.target.value })
              }
            />
          </label>
          <label>
            Semester ends
            <Input
              type="date"
              value={semester.end}
              min={semester.start || undefined}
              required
              onChange={(event) =>
                onSemester({ ...semester, end: event.target.value })
              }
            />
          </label>
        </div>
        <p className="field-help">
          Enter the actual teaching dates. A timetable’s creation date is not
          the semester start.
        </p>
      </div>
      <div className="class-editor-heading">
        <h3>
          Weekly sessions <span>{sessions.length}</span>
        </h3>
        <Button variant="ghost" size="sm" onClick={add}>
          <Plus size={14} />
          Add session
        </Button>
      </div>
      {!sessions.length && (
        <div className="agenda-empty">
          <h3>No sessions recognized.</h3>
          <p>
            Compare the PDF and add the missing sessions. No course information
            will be filled in for you.
          </p>
        </div>
      )}
      <div className="class-editors">
        {sessions.map((session, index) => {
          const issues = draftErrors(session);
          const schema = classSessionSchema.safeParse(session);
          const invalid = new Set(
            schema.success
              ? []
              : schema.error.issues.map((issue) => String(issue.path[0])),
          );
          const needsReview = issues.length > 0 || session.warnings.length > 0;
          return (
            <details
              key={session.id}
              className={`class-editor ${needsReview ? "has-issues" : ""}`}
              open={expanded.has(session.id)}
              onToggle={(event) => {
                const open = event.currentTarget.open;
                setExpanded((previous) => {
                  if (previous.has(session.id) === open) return previous;
                  const next = new Set(previous);
                  if (open) next.add(session.id);
                  else next.delete(session.id);
                  return next;
                });
              }}
            >
              <summary>
                <span className={`course-marker course-${session.color}`}>
                  {index + 1}
                </span>
                <span>
                  <strong>{session.name || "Unnamed session"}</strong>
                  <small>
                    {session.code || "Code missing"} /{" "}
                    {session.day === null ? "Day unclear" : DAYS[session.day]} /{" "}
                    {session.start || "??:??"}–{session.end || "??:??"}
                  </small>
                </span>
                {needsReview ? (
                  <AlertCircle size={16} className="issue-icon" />
                ) : (
                  <ChevronRight size={16} />
                )}
              </summary>
              <div className="class-editor-fields">
                <div className="source-reference">
                  {session.source.method === "manual" ? (
                    <span>Manually added</span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSourcePage(session.source.page)}
                    >
                      <FileSearch size={14} />
                      Page {session.source.page} /{" "}
                      {session.source.method === "ocr" ? "OCR" : "PDF text"}
                    </Button>
                  )}
                  {session.source.confidence !== undefined && (
                    <span title="Average confidence of the OCR words used for this row; not a correctness guarantee.">
                      {session.source.confidence}% word confidence
                    </span>
                  )}
                </div>
                <div className="form-grid">
                  <label className="field-wide">
                    Course name
                    <Input
                      value={session.name}
                      maxLength={240}
                      aria-invalid={invalid.has("name")}
                      onChange={(event) =>
                        update(session.id, "name", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Course code
                    <Input
                      value={session.code}
                      maxLength={20}
                      inputMode="numeric"
                      aria-invalid={invalid.has("code")}
                      onChange={(event) =>
                        update(session.id, "code", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Section
                    <Input
                      value={session.section}
                      maxLength={24}
                      aria-invalid={invalid.has("section")}
                      onChange={(event) =>
                        update(session.id, "section", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Day
                    <select
                      className="input"
                      value={session.day ?? ""}
                      aria-invalid={invalid.has("day")}
                      onChange={(event) =>
                        update(
                          session.id,
                          "day",
                          event.target.value === ""
                            ? null
                            : (Number(event.target.value) as Day),
                        )
                      }
                    >
                      <option value="">Choose day</option>
                      {WEEK_DAYS.map((day) => (
                        <option key={day} value={day}>
                          {DAYS[day]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Classroom
                    <Input
                      value={session.room}
                      maxLength={160}
                      placeholder="Add classroom"
                      aria-invalid={invalid.has("room")}
                      onChange={(event) =>
                        update(session.id, "room", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Start time
                    <Input
                      type="time"
                      value={session.start}
                      aria-invalid={invalid.has("start")}
                      onChange={(event) =>
                        update(session.id, "start", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    End time
                    <Input
                      type="time"
                      value={session.end}
                      aria-invalid={invalid.has("end")}
                      onChange={(event) =>
                        update(session.id, "end", event.target.value)
                      }
                    />
                  </label>
                </div>
                {(issues.length > 0 || session.warnings.length > 0) && (
                  <ul className="field-errors">
                    {[
                      ...new Set([
                        ...issues,
                        ...session.warnings.map((warning) => warning.message),
                      ]),
                    ].map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="remove-class"
                  onClick={() =>
                    onSessions(
                      sessions.filter((item) => item.id !== session.id),
                    )
                  }
                >
                  <Trash2 size={13} />
                  Remove session
                </Button>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
