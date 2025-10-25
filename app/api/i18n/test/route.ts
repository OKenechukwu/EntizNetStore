import { NextResponse } from "next/server";
import { deeplTranslate } from "@/lib/i18n/deepl";

export async function GET() {
  try {
    const de = await deeplTranslate("Hello, world!", "DE", {
      sourceLang: "EN",
      preserveFormatting: true,
    });
    return NextResponse.json({ ok: true, de });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}
