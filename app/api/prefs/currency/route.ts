// app/api/prefs/currency/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { toCurrencyCode } from "@/lib/currency";

export async function POST(request: Request) {
  const { currency } = (await request.json().catch(() => ({}))) as {
    currency?: string;
  };

  const chosen = toCurrencyCode(currency);

  // 1 year, readable by client (not httpOnly) so your forms can read it
  const cookieStore = await cookies();
  cookieStore.set("currency", chosen, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return new NextResponse(null, { status: 204 });
}
