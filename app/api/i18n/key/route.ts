// app/api/i18n/key/route.ts
import { NextResponse } from "next/server";
import { deeplTranslate } from "@/lib/i18n/deepl";
import { getKey, putKey } from "@/lib/i18n/store";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export async function POST(req: Request) {
  // Internal maintenance endpoint: writes translations via service-role-backed
  // storage, so it must never be callable anonymously.
  const { errorResponse } = await requireAdmin();
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const {
      tkey,
      baseText,
      target,
      source = "EN",
      namespace = "app",
    } = await req.json();
    if (!tkey || !baseText || !target) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const tgt = String(target).toLowerCase();
    const existing = await getKey(tgt, tkey, namespace);
    if (existing?.text) {
      return NextResponse.json({ text: existing.text, cached: true });
    }

    const translated = await deeplTranslate(String(baseText), target, {
      sourceLang: String(source),
    });
    await putKey(tgt, tkey, String(translated), namespace);

    return NextResponse.json({ text: translated });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "key-fail" },
      { status: 500 },
    );
  }
}
