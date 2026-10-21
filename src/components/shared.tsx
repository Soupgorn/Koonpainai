"use client";
import { MapPin } from "lucide-react";
import type { AvailabilityKind, Friend } from "@/lib/types";
import { statusLabel } from "@/lib/schedule";
import { useClock } from "./clock-provider";
import { ViewTransition } from "react";
import { useMotionAllowed } from "@/hooks/use-motion-allowed";
export function Avatar({
  friend,
  large = false,
  transition = false,
}: {
  friend: Friend;
  large?: boolean;
  transition?: boolean;
}) {
  const motionAllowed = useMotionAllowed();
  const avatar = (
    <span
      className={`avatar avatar-${friend.avatar} ${large ? "avatar-large" : ""}`}
      aria-hidden="true"
    >
      {friend.initials}
    </span>
  );
  return transition && motionAllowed ? (
    <ViewTransition name={`friend-${friend.id}`} share="friend-identity" default="none">
      {avatar}
    </ViewTransition>
  ) : avatar;
}
export function StatusBadge({ kind }: { kind: AvailabilityKind }) {
  return (
    <span className={`status-badge status-${kind}`}>
      <span className="status-dot" />
      {statusLabel[kind]}
    </span>
  );
}
export function Room({ children }: { children: React.ReactNode }) {
  return (
    <span className="room">
      <MapPin size={13} />
      {children}
    </span>
  );
}
export function DateDisplay() {
  const { now } = useClock();
  return (
    <div className="date-display">
      <div>
        <strong>
          {now
            ? new Intl.DateTimeFormat("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Bangkok",
              }).format(now)
            : "--:--"}
          <span className="clock-label">Bangkok</span>
        </strong>
        <span>{now ? new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year:"numeric", timeZone:"Asia/Bangkok" }).format(now) : "Today in Bangkok"}</span>
      </div>
    </div>
  );
}
