"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  LayoutGrid,
  List,
  Search,
  SearchX,
  X,
} from "lucide-react";
import type { Availability, Friend } from "@/lib/types";
import { getAvailability, localParts, nextLabel } from "@/lib/schedule";
import { fixtureLabel } from "@/lib/display";
import { useClock } from "./clock-provider";


import {
  Avatar,
  DateDisplay,
  PreviewControl,
  Room,
  StatusBadge,
} from "./shared";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Entry = { friend: Friend; status: Availability };
function FreePerson({ friend, status, now }: Entry & { now: Date }) {
  const sameDay = status.next?.date === localParts(now).date;
  const remaining = status.next
    ? Math.max(0, Math.ceil((status.next.startsAt - now.getTime()) / 60_000))
    : 0;
  const duration = sameDay
    ? `${Math.floor(remaining / 60) ? `${Math.floor(remaining / 60)}h ` : ""}${remaining % 60 ? `${remaining % 60}m` : ""}`.trim()
    : "Rest of today";
  return (
    <Link href={`/friends/${friend.id}`} className="friend-card free-person">
      <Avatar friend={friend} />
      <div className="person-name">
        <strong>
          {friend.nickname}
          <span lang="th">{friend.thaiName}</span>
        </strong>
        <span>
          {sameDay
            ? `Free until ${status.next!.session.start}`
            : "No more classes today"}
        </span>
      </div>
      <div className="window">
        <strong>{duration}</strong>
        <StatusBadge kind={status.kind} />
      </div>
      <ChevronRight size={17} />
    </Link>
  );
}
function ClassRow({
  friend,
  status,
  now,
  sample,
}: Entry & { now: Date; sample: boolean }) {
  const current = status.current[0];
  const label = sample ? fixtureLabel : (value: string) => value;
  return (
    <Link href={`/friends/${friend.id}`} className="friend-card class-row">
      <div className="identity">
        <Avatar friend={friend} />
        <div>
          <strong>
            {friend.nickname}
            <span lang="th">{friend.thaiName}</span>
          </strong>
          <span className="mobile-status">
            {current
              ? `In class until ${status.freeAt}`
              : status.kind === "no-schedule"
                ? friend.timetable
                  ? "No schedule"
                  : "No schedule"
                : "Outside semester"}
          </span>
        </div>
      </div>
      <div className="row-course">
        <strong>
          {current
            ? label(current.name)
            : status.kind === "no-schedule"
              ? friend.timetable
                ? "Availability unknown"
                : "No timetable added yet"
              : "Between semesters"}
          {status.current.length > 1 && (
            <small> +{status.current.length - 1} overlapping</small>
          )}
        </strong>
        {current && <Room>{label(current.room)}</Room>}
      </div>
      <span className="row-status">
        <StatusBadge kind={status.kind} />
        {current && <small>Until {status.freeAt}</small>}
      </span>
      <span className="row-next">
        <strong>
          {status.next && <span className="mobile-next-label">Next </span>}
          {status.next
            ? status.next.date === localParts(now).date
              ? status.next.session.start
              : nextLabel(status.next, now)
            : friend.timetable && status.kind === "no-schedule"
              ? "No class data available"
              : "No upcoming classes"}
        </strong>
        {status.next && <small>{label(status.next.session.name)}</small>}
      </span>
      <ChevronRight size={17} />
    </Link>
  );
}
export function FriendsDirectory({
  friends,
  personalFriend,
  sample = false,
}: {
  friends: Friend[];
  personalFriend?: Friend;
  sample?: boolean;
}) {
  const { now } = useClock();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const entries = useMemo(
    () =>
      now
        ? friends.map((friend) => ({
            friend,
            status: getAvailability(friend, now),
          }))
        : [],
    [friends, now],
  );
  const isFree = (entry: Entry) =>
    entry.status.kind === "free" || entry.status.kind === "upcoming";
  const free = entries.filter(isFree).length;
  const inClass = entries.filter((e) => e.status.kind === "in-class").length;
  const shown = entries.filter(
    (entry) =>
      (filter === "all" ||
        (filter === "free"
          ? isFree(entry)
          : entry.status.kind === "in-class")) &&
      `${entry.friend.nickname} ${entry.friend.thaiName}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  const available = shown.filter(isFree);
  const studying = shown.filter((e) => e.status.kind === "in-class");
  const other = shown.filter((e) =>
    ["no-schedule", "out-of-term"].includes(e.status.kind),
  );
  const personal =
    now && personalFriend ? getAvailability(personalFriend, now) : null;
  return (
    <main id="main" className="main-container dashboard">
      <section className="page-heading">
        <div>
          <h1>Find a break together.</h1>
          <p>From weekly timetables. Plans may differ.</p>
        </div>
        <DateDisplay />
      </section>
      {personal?.next && (
        <aside className="own-strip">
          <CalendarDays className="own-icon" size={24} />
          <div>
            <span className="small-label">
              Your next class{sample ? " · preview" : ""}
            </span>
            <strong>
              {sample
                ? fixtureLabel(personal.next.session.name)
                : personal.next.session.name}
            </strong>
          </div>
          <div className="own-time">
            <strong>
              {personal.next.session.start}–{personal.next.session.end}
            </strong>
            <span>
              {sample
                ? fixtureLabel(personal.next.session.room)
                : personal.next.session.room}{" "}
              ·{" "}
              {personal.next.date === localParts(now!).date
                ? "Today"
                : nextLabel(personal.next, now!).split(",")[0]}
            </span>
          </div>
          <Link href="/my-timetable" aria-label="View My Timetable">
            My Timetable <ArrowRight size={18} />
          </Link>
        </aside>
      )}
      {sample ? (
        <PreviewControl />
      ) : (
        <p className="schedule-note">
          Approved members only. Missing timetable data means availability is
          unknown.
        </p>
      )}
      <section aria-label="Friends directory">
        <div className="toolbar">
          <div className="search">
            <Search size={19} />
            <Input
              aria-label="Search friends by nickname"
              placeholder="Find someone by nickname"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div
            className="filters"
            role="group"
            aria-label="Filter by availability"
          >
            {[
              ["all", "Everyone", friends.length],
              ["free", "Free now", free],
              ["class", "In class", inClass],
            ].map(([value, label, count]) => (
              <button
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(String(value))}
              >
                {label}
                <span>{now ? count : "–"}</span>
              </button>
            ))}
          </div>
          <div
            className="view-toggle"
            role="group"
            aria-label="Directory layout"
          >
            <button
              aria-label="Grid view"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              aria-label="List view"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <List size={17} />
            </button>
          </div>
        </div>
        {(query || filter !== "all") && (
          <p className="directory-caption" role="status">
            {shown.length} {shown.length === 1 ? "friend" : "friends"} found
          </p>
        )}
        {!now ? (
          <div className="friend-grid" aria-label="Loading availability">
            {Array.from({ length: 6 }, (_, i) => (
              <div className="friend-skeleton" key={i}>
                <div />
                <div />
                <div />
              </div>
            ))}
          </div>
        ) : !shown.length ? (
          <div className="empty-state">
            <SearchX size={32} />
            <h2>
              {query
                ? `No friends matching “${query}”`
                : filter === "class"
                  ? "No confirmed classes right now."
                  : !friends.length
                    ? "No approved friends yet."
                    : "No confirmed free time right now."}
            </h2>
            <p>Try another nickname in English or Thai, or show everyone.</p>
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
            >
              Show everyone
            </Button>
          </div>
        ) : (
          <div className={view === "list" ? "friend-list" : "directory-groups"}>
            {available.length > 0 && (
              <section aria-labelledby="free-heading">
                <div className="section-title">
                  <h2 id="free-heading">
                    Free now <span>{available.length} friends</span>
                  </h2>
                  <span className="subtle">
                    Make the most of the time between classes.
                  </span>
                </div>
                <div className="free-people">
                  {available.map((e) => (
                    <FreePerson key={e.friend.id} {...e} now={now} />
                  ))}
                </div>
              </section>
            )}
            {studying.length > 0 && (
              <section
                className="class-section"
                aria-labelledby="class-heading"
              >
                <div className="section-title">
                  <h2 id="class-heading">
                    In class <span>{studying.length} friends</span>
                  </h2>
                  <span className="subtle">
                    From scheduled classes, not attendance.
                  </span>
                </div>
                <div className="roster-head" aria-hidden="true">
                  <span>Friend</span>
                  <span>Current class</span>
                  <span>Availability</span>
                  <span>Next class</span>
                  <span />
                </div>
                <div className="class-roster">
                  {studying.map((e) => (
                    <ClassRow
                      key={e.friend.id}
                      {...e}
                      now={now}
                      sample={sample}
                    />
                  ))}
                </div>
              </section>
            )}
            {other.length > 0 && (
              <section
                className="class-section"
                aria-labelledby="other-heading"
              >
                <div className="section-title">
                  <h2 id="other-heading">
                    No current schedule <span>{other.length} friends</span>
                  </h2>
                </div>
                <div className="class-roster">
                  {other.map((e) => (
                    <ClassRow
                      key={e.friend.id}
                      {...e}
                      now={now}
                      sample={sample}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </section>
      <aside className="schedule-note">
        <Clock3 size={16} />
        <span>
          Timetable-based availability. Not live location or attendance.
        </span>
      </aside>
    </main>
  );
}
