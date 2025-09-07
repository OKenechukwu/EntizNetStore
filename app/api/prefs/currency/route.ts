// app/api/prefs/currency/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY } from "@/lib/currency";

export async function POST(request: Request) {
  const { currency } = (await request.json().catch(() => ({}))) as {
    currency?: string;
  };

  const next = (currency ?? "").toUpperCase().trim();
  const chosen = SUPPORTED_CURRENCIES.includes(next) ? next : DEFAULT_CURRENCY;

  // 1 year, readable by client (not httpOnly) so your forms can read it
  cookies().set("currency", chosen, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return new NextResponse(null, { status: 204 });
}
