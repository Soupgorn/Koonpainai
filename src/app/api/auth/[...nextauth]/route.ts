import { handlers } from "@/auth";
import { readAuthSettings } from "@/lib/auth/settings";
import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: NextRequest) {
  const settings = readAuthSettings();
  if (!settings)
    return Response.json(
      { error: "AuthenticationUnavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  // Next can represent the internal request URL as 0.0.0.0 behind its server.
  // Validate the external Host; Auth.js rewrites URL origins using AUTH_URL.
  const canonical = new URL(settings.origin);
  const forwarded = request.headers.get("x-forwarded-host");
  if (
    request.headers.get("host") !== canonical.host ||
    (forwarded && forwarded !== canonical.host)
  )
    return Response.json(
      { error: "InvalidOrigin" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  return request.method === "POST"
    ? handlers.POST(request)
    : handlers.GET(request);
}
export const GET = handle;
export const POST = handle;
