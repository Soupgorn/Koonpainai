import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isFictionalPreview, readAuthSettings } from "./lib/auth/settings";
/** Optimistic encrypted-cookie check only. DAL and every action recheck storage and approval. */
export async function proxy(request: NextRequest) {
  if (isFictionalPreview()) return NextResponse.next();
  const settings = readAuthSettings();
  const login = new URL("/login", settings?.origin ?? request.url);
  if (!settings) return NextResponse.redirect(login);
  const token = await getToken({
    req: request,
    secret: settings.secret,
    secureCookie: new URL(settings.origin).protocol === "https:",
  });
  if (
    !token ||
    typeof token.userId !== "string" ||
    typeof token.sid !== "string" ||
    typeof token.deadline !== "number" ||
    token.deadline <= Date.now() / 1000
  )
    return NextResponse.redirect(login);
  return NextResponse.next();
}
export const config = {
  matcher: [
    "/",
    "/friends/:path*",
    "/admin/:path*",
    "/onboarding/:path*",
    "/pending-approval",
    "/my-timetable/:path*",
    "/account/:path*",
  ],
};
