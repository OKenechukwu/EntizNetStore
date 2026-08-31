import type { NextRequest } from "next/server";
import { shouldSendNoIndex } from "@/lib/launch/publicIndexing";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Preserve the exact response returned by the Supabase session refresher so
  // rotated auth cookies remain synchronized between browser and server.
  const response = await updateSupabaseSession(request);

  if (!request.cookies.get("locale")) {
    response.cookies.set("locale", "en", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  if (!request.cookies.get("currency")) {
    response.cookies.set("currency", "USD", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  if (shouldSendNoIndex(request.nextUrl.pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
