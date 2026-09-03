import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { toCurrencyCode } from "@/lib/currency";
import {
  CURRENCY_COOKIE,
  LEGACY_CURRENCY_KEYS,
} from "@/lib/preferences";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { currency?: string };
  const chosen = toCurrencyCode(body.currency);
  const store = await cookies();
  store.set(CURRENCY_COOKIE, chosen, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  for (const legacy of LEGACY_CURRENCY_KEYS) store.delete(legacy);
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
