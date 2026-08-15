// app/api/i18n/auto/route.ts
import { NextResponse } from "next/server";
import { deeplTranslate } from "@/lib/i18n/deepl";
import { getDynamic, putDynamic, hashDynamic } from "@/lib/i18n/store";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export async function POST(req: Request) {
  // Internal maintenance endpoint: writes translations via service-role-backed
  // storage, so it must never be callable anonymously.
  const { errorResponse } = await requireAdmin();
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const { text, target, source } = await req.json();
    if (!text || !target) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const src = String(source || "EN").toUpperCase();
    const tgt = String(target).toUpperCase();

    const sig = hashDynamic(src, tgt, String(text));
    const cached = await getDynamic(tgt.toLowerCase(), sig);
    if (cached?.text) {
      return NextResponse.json({ translated: cached.text });
    }

    const translated = await deeplTranslate(String(text), tgt, {
      sourceLang: src,
    });
    await putDynamic(tgt.toLowerCase(), sig, String(translated));

    return NextResponse.json({ translated });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "translate-fail" },
      { status: 500 },
    );
  }
}
