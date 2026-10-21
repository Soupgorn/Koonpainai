"use client";
import { useState } from "react";
import Link from "next/link";
import { BookOpen, Coffee, MapPin } from "lucide-react";
import type { ClassSession, Friend } from "@/lib/types";
import {
  DAYS,
  WEEK_DAYS,
  daySessions,
  getAvailability,
  localParts,
  minutes,
  placeOverlaps,
} from "@/lib/schedule";
import { useClock } from "./clock-provider";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
export function WeeklyTimetable({
  friend,
  compact = false,
  personal = false,
}: {
  friend: Friend;
  compact?: boolean;
  personal?: boolean;
}) {
  const { now } = useClock();
  const local = now ? localParts(now) : null;
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const day = selectedDay ?? local?.day ?? 1;
  const [selected, setSelected] = useState<ClassSession | null>(null);
  const currentIds = now
    ? getAvailability(friend, now).current.map((s) => s.id)
    : [];
  const start = Math.min(
    480,
    ...friend.sessions.map((s) => Math.floor(minutes(s.start) / 60) * 60),
  );
  const end = Math.max(
    1080,
    ...friend.sessions.map((s) => Math.ceil(minutes(s.end) / 60) * 60),
  );
  const height = ((end - start) / 60) * (compact ? 49 : 58);
  const timeLabel = (n: number) =>
    `${Math.floor(n / 60)
      .toString()
      .padStart(2, "0")}:00`;
  if (!friend.sessions.length)
    return (
      <div className="empty-state timetable-empty">
        <BookOpen size={32} strokeWidth={1.4} />
        <h3>No timetable yet</h3>
        <p>{personal ? "Add your timetable to see your weekly classes." : "Classes and availability will appear when a timetable is shared."}</p>
        {personal && <Button asChild><Link href="/my-timetable/import">Update timetable</Link></Button>}
      </div>
    );
  const agenda = daySessions(friend, day);
  return (
    <>
      <div className="desktop-timetable">
        <div className="timetable-day-head">
          <span>Time</span>
          {WEEK_DAYS.map((d) => (
            <div className={d === local?.day ? "today" : ""} key={d}>
              {DAYS[d].slice(0, 3)}
              {d === local?.day && <span>Today</span>}
            </div>
          ))}
        </div>
        <div className="timetable-grid" style={{ height }}>
          <div className="time-axis">
            {Array.from({ length: (end - start) / 60 + 1 }, (_, i) => (
              <span
                style={{ top: `${(i / ((end - start) / 60)) * 100}%` }}
                key={i}
              >
                {timeLabel(start + i * 60)}
              </span>
            ))}
          </div>
          {WEEK_DAYS.map((d) => (
            <div
              key={d}
              className={`day-column ${d === local?.day ? "today-column" : ""}`}
            >
              {Array.from({ length: (end - start) / 60 }, (_, i) => (
                <div
                  className="hour-rule"
                  key={i}
                  style={{ top: `${(i / ((end - start) / 60)) * 100}%` }}
                />
              ))}
              {placeOverlaps(daySessions(friend, d)).map(
                ({ session: s, lane, lanes }) => (
                  <button
                    key={s.id}
                    aria-label={`${s.name}, ${DAYS[d]} ${s.start} to ${s.end}, ${s.room}${currentIds.includes(s.id) ? ", ongoing" : ""}`}
                    className={`timetable-event course-${s.color} ${minutes(s.end) - minutes(s.start) < 120 ? "short-event" : ""} ${currentIds.includes(s.id) ? "event-ongoing" : ""}`}
                    style={{
                      top: `${((minutes(s.start) - start) / (end - start)) * 100}%`,
                      height: `${((minutes(s.end) - minutes(s.start)) / (end - start)) * 100}%`,
                      left: `calc(${(lane / lanes) * 100}% + 3px)`,
                      width: `calc(${100 / lanes}% - 6px)`,
                    }}
                    onClick={() => setSelected(s)}
                  >
                    <span className="event-time">
                      {s.start}–{s.end}
                    </span>
                    <strong>{s.name}</strong>
                    <span>{s.room}</span>
                    <small>
                      {currentIds.includes(s.id)
                        ? "In class now"
                        : `${s.code} / Sec ${s.section}`}
                    </small>
                  </button>
                ),
              )}
              {d === local?.day &&
                local.minute >= start &&
                local.minute <= end && (
                  <div
                    className="now-line"
                    aria-hidden="true"
                    style={{
                      top: `${((local.minute - start) / (end - start)) * 100}%`,
                    }}
                  />
                )}
            </div>
          ))}
        </div>
      </div>
      <div className="mobile-timetable">
        <div
          className="day-selector"
          role="group"
          aria-label="Select timetable day"
        >
          {WEEK_DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              aria-pressed={day === d}
            >
              <span>{DAYS[d].slice(0, 3)}</span>
              <i className={d === local?.day ? "day-today-dot" : ""} />
            </button>
          ))}
        </div>
        <div className="agenda-heading">
          <h3>{DAYS[day]}</h3>
          <span>
            {agenda.length} {agenda.length === 1 ? "class" : "classes"}
            {day === local?.day ? " today" : ""}
          </span>
        </div>
        {agenda.length ? (
          <div className="agenda-list">
            {agenda.map((s) => (
              <button
                className={`agenda-event course-${s.color} ${currentIds.includes(s.id) ? "event-ongoing" : ""}`}
                key={s.id}
                onClick={() => setSelected(s)}
              >
                <span className="agenda-time">
                  {s.start}
                  <span>{s.end}</span>
                </span>
                <div>
                  <span className="agenda-status">
                    {currentIds.includes(s.id)
                      ? "In class now"
                      : `${s.code} / Section ${s.section}`}
                  </span>
                  <h4>{s.name}</h4>
                  <span className="room">
                    <MapPin size={13} />
                    {s.room}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="agenda-empty">
            <Coffee size={26} strokeWidth={1.4} />
            <h3>No classes on {DAYS[day]}.</h3>
            <p>A little more time for everything else.</p>
          </div>
        )}
      </div>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent>
          {selected && (
            <>
              <div className="dialog-heading-icon">
                <BookOpen size={22} />
              </div>
              <DialogTitle className="dialog-title">
                {selected.name}
              </DialogTitle>
              <DialogDescription className="dialog-description">
                {friend.nickname}’s weekly class
              </DialogDescription>
              <dl className="class-details">
                <div>
                  <dt>Day</dt>
                  <dd>{DAYS[selected.day]}</dd>
                </div>
                <div>
                  <dt>Time</dt>
                  <dd>
                    {selected.start}–{selected.end}
                  </dd>
                </div>
                <div>
                  <dt>Classroom</dt>
                  <dd>{selected.room}</dd>
                </div>
                <div>
                  <dt>Course code</dt>
                  <dd>{selected.code}</dd>
                </div>
                <div>
                  <dt>Section</dt>
                  <dd>{selected.section}</dd>
                </div>
              </dl>
              <p className="dialog-footnote">
                All times are in Asia/Bangkok. Repeats within{" "}
                {friend.semester.name}.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
