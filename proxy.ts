import { NextRequest, NextResponse } from "next/server";
import { shouldSendNoIndex } from "@/lib/launch/publicIndexing";
import { evaluateRequestIntegrity, resolveRequestOrigin } from "@/lib/security/requestIntegrity";
import { updateSupabaseSession } from "@/lib/supabase/proxy";
import {
  CURRENCY_COOKIE,
  LEGACY_CURRENCY_KEYS,
  LEGACY_LOCALE_KEYS,
  LOCALE_COOKIE,
  toLocale,
} from "@/lib/preferences";
import { toCurrencyCode } from "@/lib/currency";

export async function proxy(request: NextRequest) {
  const integrity = evaluateRequestIntegrity({
    method: request.method,
    pathname: request.nextUrl.pathname,
    requestOrigin: resolveRequestOrigin({
      requestOrigin: request.nextUrl.origin,
      hostHeader: request.headers.get("host"),
    }),
    originHeader: request.headers.get("origin"),
    secFetchSite: request.headers.get("sec-fetch-site"),
  });

  if (!integrity.allowed) {
    console.warn("[request-integrity] rejected API mutation", {
      method: request.method,
      pathname: request.nextUrl.pathname,
      reason: integrity.reason,
    });
    const response = NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" } },
    );
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
  }

  const response = await updateSupabaseSession(request);

  const localeCandidate =
    request.cookies.get(LOCALE_COOKIE)?.value ||
    LEGACY_LOCALE_KEYS.map((key) => request.cookies.get(key)?.value).find(Boolean);
  const currencyCandidate =
    request.cookies.get(CURRENCY_COOKIE)?.value ||
    LEGACY_CURRENCY_KEYS.map((key) => request.cookies.get(key)?.value).find(Boolean);

  if (!request.cookies.get(LOCALE_COOKIE)) {
    response.cookies.set(LOCALE_COOKIE, toLocale(localeCandidate), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  if (!request.cookies.get(CURRENCY_COOKIE)) {
    response.cookies.set(CURRENCY_COOKIE, toCurrencyCode(currencyCandidate), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  for (const key of [...LEGACY_LOCALE_KEYS, ...LEGACY_CURRENCY_KEYS]) {
    if (request.cookies.get(key)) {
      response.cookies.set(key, "", { path: "/", maxAge: 0, sameSite: "lax" });
    }
  }

  if (shouldSendNoIndex(request.nextUrl.pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  return response;
}

export const config = { matcher: ["/((?!_next|.*\\..*).*)"] };
