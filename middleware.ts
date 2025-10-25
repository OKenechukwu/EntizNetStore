// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // If no locale cookie yet, set to 'en'
  if (!req.cookies.get("locale")) {
    res.cookies.set("locale", "en", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  // (Optional) seed currency if you want
  if (!req.cookies.get("currency")) {
    res.cookies.set("currency", "USD", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"], // all pages, skip assets
};
