// app/api/prefs/language/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "@/lib/languages";

export async function POST(request: Request) {
  const { language } = (await request.json().catch(() => ({}))) as {
    language?: string;
  };

  const next = (language ?? "").toLowerCase().trim();
  const chosen = SUPPORTED_LANGUAGES.find(l => l.code === next)?.code || DEFAULT_LANGUAGE;

  // 1 year, readable by client (not httpOnly) so your forms can read it
  const cookieStore = await cookies();
  cookieStore.set("language", chosen, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return new NextResponse(null, { status: 204 });
}
