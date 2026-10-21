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
import { SiteChrome } from "@/components/site-chrome";
import { Kodchasan, Mali } from "next/font/google";
import { cn } from "@/lib/utils";

const mali = Mali({ subsets: ["thai", "latin"], weight: ["500", "600", "700"], display: "swap", variable: "--font-mali" });
const kodchasan = Kodchasan({ subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-kodchasan" });

export const metadata: Metadata = {
  title: {
    default: "Koonpinai",
    template: "%s | Koonpinai",
  },
  description:
    "View shared timetables and find time to meet your friends.",
  applicationName: "Koonpinai",
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
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
    <html lang="en" suppressHydrationWarning className={cn("font-sans", mali.variable, kodchasan.variable)}>
      <body>
        <ThemeProvider>
          <PersonalPreviewProvider
            key={member ? member.id : "fictional"}
            initialProfile={profile}
          >
            <ClockProvider>
              <a className="skip-link" href="#main">
                Skip to content
              </a>
              <SiteChrome
                showPreview={preview || !!member}
                fictional={preview}
                showAdmin={preview || member?.role === "admin"}
                viewer={profile}
              >
                {children}
              </SiteChrome>
            </ClockProvider>
          </PersonalPreviewProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
