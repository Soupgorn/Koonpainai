import { NextResponse, type NextRequest } from "next/server";

// Preview switches are not authentication and never authorize future write APIs.
export function proxy(request: NextRequest) {
  const admin =
    request.nextUrl.pathname === "/admin" ||
    request.nextUrl.pathname.startsWith("/admin/");
  const enabled =
    process.env.NODE_ENV === "development" ||
    (admin
      ? process.env.ENABLE_ADMIN_DEMO === "true"
      : process.env.ENABLE_UI_PREVIEW === "true");
  // Rewrite before streaming: a layout's notFound() can otherwise retain HTTP 200.
  if (!enabled) {
    return NextResponse.rewrite(new URL("/_not-found", request.url), {
      status: 404,
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/onboarding/:path*",
    "/pending-approval",
    "/my-timetable/:path*",
    "/account/:path*",
  ],
};
