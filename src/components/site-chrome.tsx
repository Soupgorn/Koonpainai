"use client";
import { usePathname } from "next/navigation";
import { SiteHeader } from "./site-header";

export function SiteChrome({
  children,
  ...headerProps
}: React.ComponentProps<typeof SiteHeader> & { children: React.ReactNode }) {
  if (usePathname() === "/login") return children;
  return (
    <>
      <SiteHeader {...headerProps} />
      {children}
    </>
  );
}
