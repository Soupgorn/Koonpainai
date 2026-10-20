"use client";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Clock3,
  Coffee,
  MapPin,
} from "lucide-react";
import type { Friend } from "@/lib/types";
import { getAvailability, nextLabel } from "@/lib/schedule";
import { useClock } from "./clock-provider";
import { Avatar, PreviewControl, StatusBadge } from "./shared";
import { WeeklyTimetable } from "./weekly-timetable";
export function FriendProfile({
  friend,
  embedded = false,
  sample = true,
}: {
  friend: Friend;
  embedded?: boolean;
  sample?: boolean;
}) {
  const { now } = useClock();
  const status = now ? getAvailability(friend, now) : null;
  const Container = embedded ? "div" : "main";
  const NameHeading = embedded ? "h2" : "h1";
  return (
    <Container
      id={embedded ? undefined : "main"}
      className={
        embedded
          ? "profile-page imported-profile"
          : "main-container profile-page"
      }
    >
      {!embedded && (
        <Link className="back-link" href="/">
          <ArrowLeft size={15} />
          All friends
        </Link>
      )}
      <section className="profile-heading">
        <Avatar friend={friend} large />
        <div>
          <div className="profile-name">
            <NameHeading>
              {friend.nickname}
              <span lang="th">{friend.thaiName}</span>
            </NameHeading>
            {status && <StatusBadge kind={status.kind} />}
          </div>
          <p>
            {friend.department}
            <span className="profile-school">KMITL</span>
          </p>
        </div>
      </section>
      {status && now ? (
        <section
          className={`current-summary ${status.kind === "in-class" ? "summary-in-class" : ""}`}
          aria-label="Current availability"
        >
          <div className="summary-icon">
            {status.current.length ? (
              <BookOpen size={23} strokeWidth={1.5} />
            ) : (
              <Coffee size={23} strokeWidth={1.5} />
            )}
          </div>
          <div className="summary-copy">
            <h2>
              {status.current.length
                ? `In ${status.current[0].name}`
                : status.kind === "no-schedule"
                  ? "No timetable just yet."
                  : status.kind === "out-of-term"
                    ? "Taking a semester break."
                    : "A little room in the day."}
            </h2>
            <p>
              {status.current.length ? (
                <>
                  <MapPin size={14} />
                  {status.current.map((s) => s.room).join(" / ")}
                  <span className="summary-time">
                    <Clock3 size={14} />
                    Next break at {status.freeAt}
                  </span>
                </>
              ) : status.next ? (
                <>
                  Next up: {status.next.session.name},{" "}
                  {nextLabel(status.next, now)}.
                </>
              ) : (
                "There are no upcoming classes on this timetable."
              )}
            </p>
            {status.current.length > 1 && (
              <span className="overlap-note">
                {status.current.length} classes overlap right now. Check the
                timetable before making plans.
              </span>
            )}
          </div>
        </section>
      ) : (
        <div className="summary-skeleton" />
      )}
      <section className="timetable-section">
        <div className="section-heading">
          <div>
            <h2>The week ahead</h2>
            <p>{friend.semester.name}</p>
          </div>
          <span className="timezone-note">
            <CalendarDays size={14} />
            Weekly schedule<span>Bangkok time</span>
          </span>
        </div>
        <WeeklyTimetable friend={friend} />
        {friend.sessions.length > 0 && (
          <div className="timetable-footer">
            <span>
              Semester: {friend.semester.start} to {friend.semester.end}
            </span>
            <span>Classrooms may change. Check with your friend.</span>
          </div>
        )}
      </section>
      <PreviewControl fictional={sample} />
    </Container>
  );
}
