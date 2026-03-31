import { NextRequest, NextResponse } from "next/server";

const HOST = process.env.DEEPL_API_HOST ?? "https://api.deepl.com";
const KEY = process.env.DEEPL_API_KEY!;

const MAX_CHARS_PER_REQUEST = 5000;
const ALLOWED_TARGETS = new Set([
  "en","de","fr","es","it","nl","pl","pt","pt-PT","pt-BR","ja","ko","zh","ru","tr","sv","cs","da","fi","hu","id","ro","sk","sl","bg","el","et","lt","lv","uk","vi","ar","hi","th"
]);

export async function POST(req: NextRequest) {
  try {
    const { text, targetLang, sourceLang, formality = "default", preserveFormat = true } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }
    if (!targetLang || !ALLOWED_TARGETS.has(targetLang)) {
      return NextResponse.json({ error: "Unsupported targetLang" }, { status: 400 });
    }
    if (text.length > MAX_CHARS_PER_REQUEST) {
      return NextResponse.json({ error: `Text too long. Max ${MAX_CHARS_PER_REQUEST} chars.` }, { status: 413 });
    }

    const body = new URLSearchParams({
      auth_key: KEY,
      text,
      target_lang: targetLang,
    });

    if (sourceLang) body.set("source_lang", sourceLang);
    if (formality) body.set("formality", formality);
    if (preserveFormat) {
      body.set("tag_handling", "html");
      body.set("preserve_formatting", "1");
    }

    const res = await fetch(`${HOST}/v2/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      const msg = await res.text();
      return NextResponse.json({ error: `DeepL failed: ${msg}` }, { status: 502 });
    }

    const data = await res.json();
    const translated = data?.translations?.[0]?.text ?? "";
    return NextResponse.json({ translated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
