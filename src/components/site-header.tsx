"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Clock3, Users } from "lucide-react";
import { useClock } from "./clock-provider";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Koonpinai home">
      <svg
        viewBox="0 0 32 36"
        width="27"
        height="30"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M16 33S3 22 3 14a13 13 0 0 1 26 0c0 8-13 19-13 19Z"
          stroke="currentColor"
          strokeWidth="2.8"
        />
        <path
          d="M10 14h12M16 8v12"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span>
        koonpinai
        <span className="brand-thai" lang="th">
          คุณไปไหน
        </span>
      </span>
    </Link>
  );
}
export function SiteHeader({ showAdmin = false }: { showAdmin?: boolean }) {
  const pathname = usePathname();
  const { now, preview } = useClock();
  const admin = pathname.startsWith("/admin");
  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <nav aria-label="Main navigation">
          <Link
            href="/"
            className={!admin ? "nav-link active" : "nav-link"}
            aria-current={!admin ? "page" : undefined}
          >
            <Users size={15} />
            Friends
          </Link>
          {showAdmin && (
            <Link
              href="/admin"
              className={admin ? "nav-link active" : "nav-link"}
              aria-current={admin ? "page" : undefined}
            >
              Admin
              <ArrowUpRight size={13} />
            </Link>
          )}
        </nav>
        <div className="header-clock">
          <Clock3 size={14} />
          <span>
            {now
              ? new Intl.DateTimeFormat("en-GB", {
                  timeZone: "Asia/Bangkok",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(now)
              : "--:--"}
          </span>
          <span className="clock-zone">{preview ? "Preview" : "Bangkok"}</span>
        </div>
      </div>
    </header>
  );
}
