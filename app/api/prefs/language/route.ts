import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  LEGACY_LOCALE_KEYS,
  LOCALE_COOKIE,
  toLocale,
} from "@/lib/preferences";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { language?: string; locale?: string };
  const chosen = toLocale(body.locale || body.language);
  const store = await cookies();
  store.set(LOCALE_COOKIE, chosen, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  for (const legacy of LEGACY_LOCALE_KEYS) store.delete(legacy);
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
