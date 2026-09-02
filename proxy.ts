import { NextRequest, NextResponse } from "next/server";
import { shouldSendNoIndex } from "@/lib/launch/publicIndexing";
import { evaluateRequestIntegrity } from "@/lib/security/requestIntegrity";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const integrity = evaluateRequestIntegrity({
    method: request.method,
    pathname: request.nextUrl.pathname,
    requestOrigin: request.nextUrl.origin,
    originHeader: request.headers.get("origin"),
    secFetchSite: request.headers.get("sec-fetch-site"),
  });

  // Reject cross-origin browser mutations before session refresh or route code
  // can perform an authenticated side effect. Signed/provider ingress has a
  // deliberately small exact-path exemption list in requestIntegrity.ts.
  if (!integrity.allowed) {
    const response = NextResponse.json(
      { error: "Forbidden" },
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
  }

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
