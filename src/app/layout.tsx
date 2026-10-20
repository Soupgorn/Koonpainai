import type { Metadata } from "next";
import "@fontsource-variable/noto-sans-thai";
import "./globals.css";
import "./approved-design.css";
import "./redesign.css";
import { ThemeProvider } from "@/components/theme-provider";
import { PersonalPreviewProvider } from "@/components/personal-preview-provider";
import { isUiPreviewEnabled } from "@/lib/preview";
import { currentMember } from "@/lib/auth/access";
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
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const member = await currentMember(),
    preview = isUiPreviewEnabled();
  const profile = member
    ? {
        nickname: member.nickname || member.displayName,
        thaiName: member.thaiName,
        department: member.department,
      }
    : undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <PersonalPreviewProvider
            key={member ? member.id : "fictional"}
            initialProfile={profile}
            fictional={preview}
          >
            <ClockProvider>
              <a className="skip-link" href="#main">
                Skip to content
              </a>
              <SiteHeader
                showPreview={preview || !!member}
                showAdmin={preview || member?.role === "admin"}
                viewer={profile}
              />
              {children}
              <footer className="site-footer">
                <span>
                  คุณไปไหน<span className="footer-separator">/</span>A little
                  less asking. A little more together.
                </span>
                <span>Made for the time between classes.</span>
              </footer>
            </ClockProvider>
          </PersonalPreviewProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
