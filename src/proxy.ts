import { NextResponse, type NextRequest } from "next/server";

// This disables the demo; it is not an authentication layer for future write APIs.
export function proxy(request: NextRequest) {
  if (
    process.env.NODE_ENV !== "development" &&
    process.env.ENABLE_ADMIN_DEMO !== "true"
  ) {
    return NextResponse.rewrite(new URL("/_not-found", request.url), {
      status: 404,
    });
  }
  return NextResponse.next();
}

export const config = { matcher: "/admin/:path*" };
