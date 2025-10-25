// app/api/i18n/auto/route.ts
import { NextResponse } from "next/server";
import { deeplTranslate } from "@/lib/i18n/deepl";
import { getDynamic, putDynamic, hashDynamic } from "@/lib/i18n/store";

export async function POST(req: Request) {
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
