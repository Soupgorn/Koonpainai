"use client";
import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, CalendarDays, AlertTriangle } from "lucide-react";
import { usePersonalPreview } from "./personal-preview-provider";
import { FriendProfile } from "./friend-profile";
import type { ClassSession, Day, Friend } from "@/lib/types";
import { DAYS, WEEK_DAYS } from "@/lib/schedule";
import { conflicts, courseColor, entryInput, termInput, timetableMessage, type TimetableResult } from "@/lib/timetable/model";
import { deleteTimetableEntry, saveTimetableEntry, saveTimetableTerm } from "@/lib/timetable/actions";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";

type Draft = Omit<ClassSession, "color"> & { allowOverlap: boolean };
const blank = (): Draft => ({ id: "", name: "", code: "", section: "", room: "", day: 1, start: "09:00", end: "10:00", allowOverlap: false });
export function MyTimetable({ friend, sample }: { friend: Friend; sample: boolean }) {
  const { profile } = usePersonalPreview();
  const [current, setCurrent] = useState(friend);
  const [mode, setMode] = useState<"class" | "term" | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [term, setTerm] = useState(current.semester ?? { name: "", start: "", end: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [pending, transition] = useTransition();
  const revision = current.timetable?.revision ?? 0;
  const ready = sample || current.timetable?.storageReady !== false;
  const overlaps = current.sessions.filter(s => s.id !== draft.id && conflicts(s, draft));
  const editing = (s?: ClassSession) => { setDraft(s ? { id: s.id, name: s.name, code: s.code, section: s.section, room: s.room, day: s.day, start: s.start, end: s.end, allowOverlap: false } : blank()); setError(""); setDeleting(false); setMode("class"); };
  function apply(result: TimetableResult, message: string) {
    if (result.error || !result.snapshot) { setError(result.error || "No changes were saved. Try again."); return; }
    const s = result.snapshot;
    setCurrent(previous => ({ ...previous, semester: s.semester, sessions: s.sessions, published: true, timetable: { revision: s.revision, updatedAt: s.updatedAt, storageReady: true } }));
    setMode(null); setNotice(sample ? `${message} Preview only; changes reset on reload.` : message);
  }
  function run(task: () => Promise<TimetableResult>, message: string) {
    setError(""); transition(async () => { try { apply(await task(), message); } catch { setError("The request did not complete. Check your connection and try again."); } });
  }
  function preview(sessions = current.sessions, semester = current.semester!): TimetableResult {
    return { error: "", snapshot: { semester, sessions, revision: revision + 1, updatedAt: new Date().toISOString() } };
  }
  function saveClass(e: React.FormEvent) {
    e.preventDefault();
    const input = { ...draft, id: draft.id || undefined, revision };
    const parsed = entryInput.safeParse(input);
    if (!parsed.success) { setError(timetableMessage(parsed.error)); return; }
    if (overlaps.length && !draft.allowOverlap) { setError("Review the overlapping classes and allow the overlap to continue."); return; }
    if (sample) {
      const duplicate = current.sessions.some(s => s.id !== draft.id && s.name === draft.name.trim() && s.day === draft.day && s.start === draft.start && s.end === draft.end && s.code === draft.code.trim() && s.room === draft.room.trim() && s.section === draft.section.trim());
      if (duplicate) { setError("This exact class is already in your timetable."); return; }
      const entry: ClassSession = { ...parsed.data, id: draft.id || crypto.randomUUID(), day: draft.day, color: courseColor(draft.code, draft.name) };
      apply(preview([...current.sessions.filter(s => s.id !== draft.id), entry]), draft.id ? "Class updated." : "Class added.");
    } else run(() => saveTimetableEntry(input), draft.id ? "Class updated." : "Class added.");
  }
  function saveSemester(e: React.FormEvent) {
    e.preventDefault();
    const parsed = termInput.safeParse({ ...term, revision });
    if (!parsed.success) { setError(timetableMessage(parsed.error)); return; }
    if (sample) apply(preview(current.sessions, term), "Semester saved.");
    else run(() => saveTimetableTerm(parsed.data), "Semester saved.");
  }
  const view = { ...current, ...(sample ? { ...profile, initials: profile.nickname[0]?.toUpperCase() || "?" } : {}) };
  return <main id="main" className="main-container timetable-manager">
    {!ready && <div className="form-error" role="status"><strong>Timetable storage is not enabled yet.</strong><p>Your account is safe. An administrator must approve and apply the reviewed database migration before you can save classes.</p></div>}
    {notice && <p className="form-notice" role="status">{notice}</p>}
    <FriendProfile friend={view} embedded personal sample={sample} onEdit={ready ? editing : undefined} controls={<div className="timetable-tools">
      <Button variant="outline" disabled={!ready} onClick={() => { setTerm(current.semester ?? { name: "", start: "", end: "" }); setError(""); setMode("term"); }}><CalendarDays size={16} />{current.semester ? "Edit semester" : "Set semester"}</Button>
      <Button disabled={!ready || !current.semester} onClick={() => editing()}><Plus size={16} />Add class</Button>
    </div>} />
    {current.timetable?.updatedAt && <p className="help timetable-updated">{sample ? "Preview changed" : "Last saved"} <time dateTime={current.timetable.updatedAt}>{new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }).format(new Date(current.timetable.updatedAt))}</time> · Bangkok time</p>}
    <Dialog open={mode !== null} onOpenChange={open => { if (!open && !pending) setMode(null); }}>
      <DialogContent className="timetable-editor" onEscapeKeyDown={e => { if (pending) e.preventDefault(); }} onPointerDownOutside={e => { if (pending) e.preventDefault(); }}>
        <DialogTitle className="dialog-title">{mode === "term" ? "Your semester" : deleting ? "Delete this class?" : draft.id ? "Edit class" : "Add a class"}</DialogTitle>
        <DialogDescription className="dialog-description">{mode === "term" ? "Weekly classes repeat within these dates. Changing dates keeps your existing classes." : deleting ? "This removes only this entry from your timetable. This cannot be undone." : "Add the weekly session as it appears on your schedule. Times are in Bangkok."}</DialogDescription>
        {mode === "term" ? <form onSubmit={saveSemester} className="timetable-editor-form">
          <fieldset disabled={pending}>
            <label className="field"><span>Semester name</span><input required maxLength={100} value={term.name} onChange={e => setTerm({ ...term, name: e.target.value })} placeholder="Semester 1 / 2569" /></label>
            <div className="timetable-form-pair"><label className="field"><span>Start date</span><input type="date" required value={term.start} onChange={e => setTerm({ ...term, start: e.target.value })} /></label><label className="field"><span>End date</span><input type="date" required min={term.start} value={term.end} onChange={e => setTerm({ ...term, end: e.target.value })} /></label></div>
          </fieldset>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="editor-actions"><Button variant="outline" type="button" disabled={pending} onClick={() => setMode(null)}>Cancel</Button><Button disabled={pending}>{pending ? "Saving…" : "Save semester"}</Button></div>
        </form> : deleting ? <div className="timetable-editor-form"><strong>{draft.name}</strong><p>{DAYS[draft.day]} {draft.start}–{draft.end}</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="editor-actions"><Button variant="outline" disabled={pending} onClick={() => setDeleting(false)}>Keep class</Button><Button variant="destructive" disabled={pending} onClick={() => sample ? apply(preview(current.sessions.filter(s => s.id !== draft.id)), "Class deleted.") : run(() => deleteTimetableEntry({ id: draft.id, revision }), "Class deleted.")}>{pending ? "Deleting…" : "Delete class"}</Button></div></div> : <form onSubmit={saveClass} className="timetable-editor-form">
          <fieldset disabled={pending}>
            <label className="field"><span>Course name</span><input required maxLength={240} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
            <div className="timetable-form-pair"><label className="field"><span>Course code <small>(optional)</small></span><input maxLength={64} value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} /></label><label className="field"><span>Section <small>(optional)</small></span><input maxLength={24} value={draft.section} onChange={e => setDraft({ ...draft, section: e.target.value })} /></label></div>
            <label className="field"><span>Weekday</span><select value={draft.day} onChange={e => setDraft({ ...draft, day: Number(e.target.value) as Day, allowOverlap: false })}>{WEEK_DAYS.map(d => <option key={d} value={d}>{DAYS[d]}</option>)}</select></label>
            <div className="timetable-form-pair"><label className="field"><span>Start time</span><input required type="time" step={60} value={draft.start} onChange={e => setDraft({ ...draft, start: e.target.value, allowOverlap: false })} /></label><label className="field"><span>End time</span><input required type="time" step={60} value={draft.end} onChange={e => setDraft({ ...draft, end: e.target.value, allowOverlap: false })} /></label></div>
            <label className="field"><span>Classroom / location <small>(optional)</small></span><input maxLength={160} value={draft.room} onChange={e => setDraft({ ...draft, room: e.target.value })} /></label>
            {!!overlaps.length && <div className="overlap-review"><p><AlertTriangle size={16} />Overlaps {overlaps.map(s => `${s.name} (${s.start}–${s.end})`).join(", ")}</p><label><input type="checkbox" checked={draft.allowOverlap} onChange={e => { setDraft({ ...draft, allowOverlap: e.target.checked }); setError(""); }} />Keep this overlap in my timetable</label></div>}
          </fieldset>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="editor-actions">{draft.id && <Button variant="destructive" type="button" disabled={pending} onClick={() => { setError(""); setDeleting(true); }}><Trash2 size={15} />Delete</Button>}<Button variant="outline" type="button" disabled={pending} onClick={() => setMode(null)}>Cancel</Button><Button disabled={pending}><Pencil size={15} />{pending ? "Saving…" : draft.id ? "Save changes" : "Add class"}</Button></div>
        </form>}
      </DialogContent>
    </Dialog>
  </main>;
}
