"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChevronRight, UserRound, Users } from "lucide-react";
import { ThemeControl } from "./theme-provider";
import { usePersonalPreview } from "./personal-preview-provider";
export function BrandMark() {
  return (
    <svg
      className="brand-mark"
      width="31"
      height="31"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 7v18M13 7v18M24 7 14 16l10 9"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Koonpinai home">
      <BrandMark />
      <span>
        koonpinai<small lang="th">คุณไปไหน</small>
      </span>
    </Link>
  );
}
export function SiteHeader({
  showAdmin = false,
  showPreview = false,
  viewer,
}: {
  showAdmin?: boolean;
  showPreview?: boolean;
  viewer?: { nickname: string };
}) {
  const pathname = usePathname();
  const { profile: previewProfile } = usePersonalPreview();
  const profile = viewer ?? previewProfile;
  const entry = [
    "/login",
    "/onboarding",
    "/onboarding/policy",
    "/pending-approval",
  ].includes(pathname);
  const timetable = pathname.startsWith("/my-timetable");
  const account = pathname === "/account";
  const links = [
    {
      href: "/",
      label: "Friends",
      icon: Users,
      active: pathname === "/" || pathname.startsWith("/friends/"),
    },
    ...(showPreview
      ? [
          {
            href: "/my-timetable",
            label: "My Timetable",
            icon: CalendarDays,
            active: timetable,
          },
        ]
      : []),
  ];
  return (
    <>
      <header className={`topbar ${entry ? "entry-header" : ""}`}>
        <Brand />
        {!entry && (
          <nav className="desktop-nav" aria-label="Main navigation">
            {links.map(({ href, label, icon: Icon, active }) => (
              <Link
                key={href}
                href={href}
                className={active ? "active" : ""}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
            {showAdmin && (
              <Link
                href="/admin"
                className={pathname.startsWith("/admin") ? "active" : ""}
              >
                Admin
              </Link>
            )}
          </nav>
        )}
        <div className="header-right">
          <span className="community">
            {entry ? "Where are your friends?" : null}
          </span>
          <ThemeControl />
          {!entry &&
            (showPreview ? (
              <Link
                className="account"
                href="/account"
                aria-label="Account settings"
              >
                <span className="avatar avatar-4 small">
                  {profile.nickname[0]?.toUpperCase()}
                </span>
                <span>
                  {profile.nickname}
                  <ChevronRight size={13} />
                </span>
              </Link>
            ) : (
              <Link className="button button-primary" href="/login">
                Sign in
              </Link>
            ))}
        </div>
      </header>
      {!entry && (
        <nav className="bottom-nav" aria-label="Mobile navigation">
          {links.map(({ href, label, icon: Icon, active }) => (
            <Link
              key={href}
              href={href}
              className={active ? "active" : ""}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={22} />
              {label}
            </Link>
          ))}
          <Link
            href={showPreview ? "/account" : "/login"}
            className={account ? "active" : ""}
            aria-current={account ? "page" : undefined}
          >
            <UserRound size={22} />
            Account
          </Link>
        </nav>
      )}
    </>
  );
}
