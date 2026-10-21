"use client";
import Link from "next/link";
import { ArrowLeft, Clock3, MapPin, Upload } from "lucide-react";
import type { Friend } from "@/lib/types";
import {
  getAvailability,
  localParts,
  minutes,
  nextLabel,
} from "@/lib/schedule";
import { fixtureLabel } from "@/lib/display";
import { useClock } from "./clock-provider";
import { Avatar, DateDisplay, StatusBadge } from "./shared";
import { WeeklyTimetable } from "./weekly-timetable";
import { Button } from "./ui/button";
export function FriendProfile({
  friend,
  embedded = false,
  sample = true,
  personal = false,
}: {
  friend: Friend;
  embedded?: boolean;
  sample?: boolean;
  personal?: boolean;
}) {
  const { now } = useClock();
  const status = now ? getAvailability(friend, now) : null;
  const Container = embedded ? "div" : "main";
  const Heading = embedded ? "h2" : "h1";
  const label = (value: string) => (sample ? fixtureLabel(value) : value);
  const current = status?.current[0];
  const next = status?.next;
  // A break starts after the whole contiguous/overlapping run, not just the first class.
  const breakEnd =
    now && status?.freeAt
      ? friend.sessions
          .filter(
            (s) =>
              s.day === localParts(now).day &&
              minutes(s.start) > minutes(status.freeAt!),
          )
          .sort((a, b) => minutes(a.start) - minutes(b.start))[0]
      : null;
  return (
    <Container
      id={embedded ? undefined : "main"}
      className={
        embedded
          ? "profile-page imported-profile"
          : "main-container profile-page"
      }
    >
      {!embedded && !personal && (
        <Link className="back-link" href="/">
          <ArrowLeft size={15} />
          All friends
        </Link>
      )}
      <section className="profile-hero">
        {!personal && <Avatar friend={friend} large transition={!embedded} />}
        <div className="profile-title">
          <Heading>
            {personal ? (
              "My Timetable"
            ) : (
              <>
                {friend.nickname}
                <span lang="th">{friend.thaiName}</span>
              </>
            )}
          </Heading>
          {!personal && <p>{friend.department} · KMITL</p>}
        </div>
        {personal ? (
          <Button asChild>
            <Link href="/my-timetable/import">
              <Upload size={16} />
              Update timetable
            </Link>
          </Button>
        ) : (
          !embedded && <DateDisplay />
        )}
      </section>
      {personal && !sample && friend.sessions.length > 0 && (
        <p className="import-retention">Temporary import. Export a copy before leaving.</p>
      )}
      {friend.sessions.length > 0 && (status && now ? (
        <section className="schedule-summary" aria-label="Current availability">
          <div>
            <div className="status-title">
              <StatusBadge kind={status.kind} />
              {current && <span>Scheduled until {status.freeAt}</span>}
            </div>
            <h2>
              {current
                ? `In ${label(current.name)}`
                : status.kind === "no-schedule"
                  ? "No timetable just yet."
                  : status.kind === "out-of-term"
                    ? "Taking a semester break."
                    : "Free right now."}
            </h2>
            <p>
              {current ? (
                <>
                  <MapPin size={16} />
                  {status.current.map((s) => label(s.room)).join(" / ")}
                  <span>
                    {current.start}–{current.end}
                  </span>
                </>
              ) : next ? (
                `Free until ${nextLabel(next, now)}`
              ) : (
                "No upcoming classes on this timetable."
              )}
            </p>
            {status.current.length > 1 && (
              <p className="overlap-note">
                {status.current.length} classes overlap right now. Check the
                timetable before making plans.
              </p>
            )}
          </div>
          <div className="summary-next">
            <span className="small-label">
              {next ? `Next class · ${nextLabel(next, now)}` : "Next class"}
            </span>
            <strong>
              {next ? label(next.session.name) : "No upcoming classes"}
            </strong>
            {next && <span>{label(next.session.room)}</span>}
          </div>
          <div className="free-between">
            <Clock3 size={24} />
            <div>
              <strong>
                {current
                  ? `Next break at ${status.freeAt}`
                  : status.kind === "free" || status.kind === "upcoming"
                    ? "A little time for you"
                    : "Availability unavailable"}
              </strong>
              <span>
                {current
                  ? breakEnd
                    ? `Free from ${status.freeAt} to ${breakEnd.start}`
                    : `No more classes after ${status.freeAt}`
                  : "Timetables, not live locations"}
              </span>
            </div>
          </div>
        </section>
      ) : (
        <div className="summary-skeleton" />
      ))}
      <section className="timetable-section">
        <div className="week-heading">
          <div>
            <h2>{personal ? "Your week" : `${friend.nickname}’s week`}</h2>
            {friend.sessions.length > 0 && <p>
              {friend.semester.name} · {friend.semester.start} to{" "}
              {friend.semester.end}
            </p>}
          </div>
          <span className="timezone-note">Weekly schedule · Bangkok time</span>
        </div>
        <WeeklyTimetable
          personal={personal}
          friend={
            sample
              ? {
                  ...friend,
                  sessions: friend.sessions.map((s) => ({
                    ...s,
                    name: label(s.name),
                    room: label(s.room),
                  })),
                }
              : friend
          }
        />
      </section>
    </Container>
  );
}
