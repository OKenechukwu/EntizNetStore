// middleware.ts
// Security middleware for EntizNetStore
import { NextRequest, NextResponse } from "next/server";

/** Apply strong security headers to any response */
function applySecurityHeaders(res: NextResponse) {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-XSS-Protection", "1; mode=block");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  // HSTS (HTTPS only; fine on Vercel/prod)
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );

  // CSP tuned for Next.js + Supabase + websockets + Google Fonts
  // Keep 'unsafe-inline' (and 'unsafe-eval' for dev). Tighten later if desired.
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https: https://fonts.gstatic.com",
    "connect-src 'self' https: wss:",
    "media-src 'self' blob: https:",
    "frame-src 'none'",
  ].join("; ");

  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const pathname = url.pathname;

  const isProd =
    process.env.NEXT_PUBLIC_APP_ENV === "prod" ||
    process.env.VERCEL_ENV === "production";

  // Hard-block internal debug routes in production
  if (
    isProd &&
    (pathname.startsWith("/dev-test") || pathname.startsWith("/_debug-routes"))
  ) {
    const to = url.clone();
    to.pathname = "/";
    to.search = "";
    return applySecurityHeaders(NextResponse.redirect(to, 307));
  }

  // Default pass-through with headers
  const response = applySecurityHeaders(NextResponse.next());

  // Light API telemetry headers (informational example)
  if (pathname.startsWith("/api/")) {
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0] : undefined;
    response.headers.set("X-RateLimit-Limit", "100");
    response.headers.set("X-RateLimit-Remaining", "99"); // placeholder
    response.headers.set("X-Client-IP", ip || "unknown");
  }

  return response;
}

/**
 * Run on most routes, but explicitly skip:
 * - Next.js internals & assets
 * - Auth/onboarding pages to avoid interference
 */
export const config = {
  matcher: [
    // Everything except: _next, image optimizer, favicon,
    // and our auth/onboarding paths.
    "/((?!_next/static|_next/image|favicon.ico" +
      "|auth$" +
      "|auth/sign-in" +
      "|auth/sign-up" +
      "|auth/forgot-password" +
      "|signin" + // in case you also keep the alias
      "|register" +
      "|age-check" +
      "|select-role" +
      "|welcome" +
      "|_debug-routes" +
      ").*)",
  ],
};
