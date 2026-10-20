import type { Metadata } from "next";
import "@fontsource-variable/noto-sans-thai";
import "./globals.css";
import { ClockProvider } from "@/components/clock-provider";
import { SiteHeader } from "@/components/site-header";
export const metadata: Metadata = {
  title: {
    default: "Koonpinai — Where are your friends?",
    template: "%s · Koonpinai",
  },
  description:
    "Find a little time together. See your friends’ class schedules and availability at a glance. คุณไปไหน",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ClockProvider>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <SiteHeader
            showAdmin={
              process.env.NODE_ENV === "development" ||
              process.env.ENABLE_ADMIN_DEMO === "true"
            }
          />
          {children}
          <footer className="site-footer">
            <span>
              คุณไปไหน<span className="footer-separator">/</span>A little less
              asking. A little more together.
            </span>
            <span>Made for the time between classes.</span>
          </footer>
        </ClockProvider>
      </body>
    </html>
  );
}
