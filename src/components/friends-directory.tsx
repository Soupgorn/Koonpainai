"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Clock3,
  LayoutGrid,
  List,
  Search,
  SearchX,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Friend } from "@/lib/types";
import {
  daySessions,
  getAvailability,
  localParts,
  minutes,
  nextLabel,
} from "@/lib/schedule";
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

function DayRibbon({ friend, now }: { friend: Friend; now: Date }) {
  const local = localParts(now);
  const availability = getAvailability(friend, now);
  if (
    availability.kind === "out-of-term" ||
    availability.kind === "no-schedule"
  )
    return null;
  const sessions = daySessions(friend, local.day);
  const currentIds = new Set(availability.current.map((session) => session.id));
  return (
    <div className="day-ribbon" aria-hidden="true">
      <span>08</span>
      <div className="ribbon-track">
        {sessions.map((s) => (
          <i
            key={s.id}
            className={currentIds.has(s.id) ? "ribbon-ongoing" : ""}
            style={{
              left: `${Math.max(0, ((minutes(s.start) - 480) / 600) * 100)}%`,
              width: `${((minutes(s.end) - minutes(s.start)) / 600) * 100}%`,
            }}
          />
        ))}
        {local.minute >= 480 && local.minute <= 1080 && (
          <b style={{ left: `${((local.minute - 480) / 600) * 100}%` }} />
        )}
      </div>
      <span>18</span>
    </div>
  );
}
function FriendCard({ friend, now }: { friend: Friend; now: Date }) {
  const status = getAvailability(friend, now);
  const current = status.current[0];
  return (
    <Link href={`/friends/${friend.id}`} className="friend-card">
      <div className="friend-card-top">
        <Avatar friend={friend} />
        <div className="friend-name">
          <h2>
            {friend.nickname}
            <span lang="th">{friend.thaiName}</span>
          </h2>
          <span>{friend.department}</span>
        </div>
        <ArrowUpRight className="card-arrow" size={17} />
      </div>
      <div className="friend-card-body">
        <StatusBadge kind={status.kind} />
        {current ? (
          <>
            <h3>
              {current.name}
              {status.current.length > 1 && (
                <small> +{status.current.length - 1} overlapping</small>
              )}
            </h3>
            <div className="card-meta">
              <Room>{current.room}</Room>
              <span>
                <Clock3 size={13} />
                Until {current.end}
              </span>
            </div>
          </>
        ) : (
          <>
            <h3 className="available-copy">
              {status.kind === "no-schedule"
                ? "Their week is still a mystery."
                : status.kind === "out-of-term"
                  ? "Between semesters."
                  : status.kind === "upcoming"
                    ? "Time for a quick catch-up."
                    : "A good time to say hello."}
            </h3>
            <div className="card-meta">
              <Clock3 size={13} />
              <span>
                {status.kind === "no-schedule"
                  ? "No timetable added yet"
                  : status.kind === "out-of-term"
                    ? "Outside the academic date range"
                    : status.next?.date === localParts(now).date
                      ? `Free until ${status.next.session.start}`
                      : "No more classes today"}
              </span>
            </div>
          </>
        )}
      </div>
      <div className="friend-card-bottom">
        {current && status.freeAt !== current.end ? (
          <span>
            <BookOpen size={13} />
            Next break at {status.freeAt}
          </span>
        ) : status.next ? (
          <span className="next-class">
            <span>Next</span>
            <span>{status.next.session.name}</span>
            {(!!current || status.next.date !== localParts(now).date) && (
              <time>{nextLabel(status.next, now)}</time>
            )}
          </span>
        ) : (
          <span>No upcoming classes this semester</span>
        )}
        <DayRibbon friend={friend} now={now} />
      </div>
    </Link>
  );
}
export function FriendsDirectory({ friends }: { friends: Friend[] }) {
  const { now } = useClock();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const statuses = useMemo(
    () =>
      now
        ? friends.map((friend) => ({
            friend,
            status: getAvailability(friend, now),
          }))
        : [],
    [friends, now],
  );
  const inClass = statuses.filter((s) => s.status.kind === "in-class").length;
  const free = statuses.filter((s) =>
    ["free", "upcoming"].includes(s.status.kind),
  ).length;
  const shown = statuses.filter(
    ({ friend, status }) =>
      (filter === "all" ||
        (filter === "class" && status.kind === "in-class") ||
        (filter === "free" && ["free", "upcoming"].includes(status.kind))) &&
      `${friend.nickname} ${friend.thaiName}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <main id="main" className="main-container">
      <section className="directory-intro">
        <div>
          <h1>Where’s everyone?</h1>
          <p>Find your people. Catch a break together.</p>
          <div className="overview">
            <span>
              <UsersIcon />
              {friends.length} friends
            </span>
            <span>
              <i className="tiny-dot amber" />
              {now ? inClass : "–"} in class
            </span>
            <span>
              <i className="tiny-dot green" />
              {now ? free : "–"} free now
            </span>
          </div>
        </div>
        <DateDisplay />
      </section>
      <PreviewControl />
      <section aria-label="Friends directory">
        <div className="directory-toolbar">
          <div className="search-field">
            <Search size={17} />
            <Input
              aria-label="Search friends by nickname"
              placeholder="Find a friend…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search">
                <X size={16} />
              </button>
            )}
            <span className="search-hint">{friends.length} friends</span>
          </div>
          <div
            className="filter-tabs"
            role="group"
            aria-label="Filter by availability"
          >
            {[
              ["all", "Everyone", friends.length],
              ["class", "In class", inClass],
              ["free", "Free now", free],
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
        <div className="directory-caption">
          <span aria-live="polite">
            {query || filter !== "all"
              ? `${shown.length} ${shown.length === 1 ? "friend" : "friends"} found`
              : "A familiar face is always close by."}
          </span>
          <span>
            <span className="tiny-dot green" />
            Updates with the timetable
          </span>
        </div>
        {!now ? (
          <div className="friend-grid">
            {Array.from({ length: 6 }, (_, i) => (
              <div className="friend-skeleton" key={i}>
                <div />
                <div />
                <div />
              </div>
            ))}
          </div>
        ) : shown.length ? (
          <div
            className={`friend-grid ${view === "list" ? "friend-list" : ""}`}
          >
            {shown.map(({ friend }) => (
              <FriendCard key={friend.id} friend={friend} now={now} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <SearchX size={32} strokeWidth={1.4} />
            <h2>
              {query
                ? `No friends matching “${query}”`
                : filter === "class"
                  ? "Everyone’s out of class."
                  : "No one’s free just now."}
            </h2>
            <p>
              {query
                ? "Try another nickname, in English or Thai."
                : "Try everyone to see what the rest of the week looks like."}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
            >
              <SlidersHorizontal size={15} />
              Show everyone
            </Button>
          </div>
        )}
      </section>
      <aside className="schedule-note">
        <span className="note-icon">
          <BookOpen size={18} strokeWidth={1.6} />
        </span>
        <div>
          <h2>A schedule, not a location.</h2>
          <p>
            Availability is based on class timetables. Your friends might be
            grabbing coffee somewhere else.
          </p>
        </div>
      </aside>
    </main>
  );
}
function UsersIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5" />
    </svg>
  );
}
