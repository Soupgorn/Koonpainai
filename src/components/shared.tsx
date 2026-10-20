"use client";
import { FlaskConical, MapPin } from "lucide-react";
import { Button } from "./ui/button";
import type { AvailabilityKind, Friend } from "@/lib/types";
import { statusLabel } from "@/lib/schedule";
import { useClock } from "./clock-provider";
export function Avatar({
  friend,
  large = false,
}: {
  friend: Friend;
  large?: boolean;
}) {
  return (
    <span
      className={`avatar avatar-${friend.avatar} ${large ? "avatar-large" : ""}`}
      aria-hidden="true"
    >
      {friend.initials}
    </span>
  );
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
export function PreviewControl({ fictional = true }: { fictional?: boolean }) {
  const { preview, setPreview } = useClock();
  return (
    <div className={`preview-control ${preview ? "preview-active" : ""}`}>
      <FlaskConical size={14} />
      <span>
        {preview
          ? "Time preview: Tue 20 Oct, 10:30"
          : fictional
            ? "Fictional friends. Real Bangkok time."
            : "Private timetable preview. Bangkok time."}
      </span>
      {preview && fictional && (
        <span className="preview-data-label">Fictional friends</span>
      )}
      <Button variant="ghost" size="sm" onClick={() => setPreview(!preview)}>
        {preview ? "Return to live" : "Try a class-time preview"}
      </Button>
    </div>
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
