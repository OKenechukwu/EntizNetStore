import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { LEGACY_LOCALE_KEYS, LOCALE_COOKIE, toLocale } from "@/lib/preferences";

export async function POST(request: Request) {
  const { language } = (await request.json().catch(() => ({}))) as { language?: string };
  const chosen = toLocale(language);
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, chosen, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  for (const legacy of LEGACY_LOCALE_KEYS) cookieStore.delete(legacy);
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
