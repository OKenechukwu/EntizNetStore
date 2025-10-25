// app/api/i18n/seed-all/route.ts
import { NextResponse } from "next/server";
import { deeplTranslate } from "@/lib/i18n/deepl";
import { getKey, putKey } from "@/lib/i18n/store";
import { getDict } from "@/lib/i18n/dictionaries";

const SUP_LOCALES = (process.env.NEXT_PUBLIC_SUPPORTED_LOCALES || "en")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const ADMIN_SEED_TOKEN = process.env.ADMIN_SEED_TOKEN || "";

function flatten(
  obj: Record<string, any>,
  prefix = "",
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[path] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v, path));
  }
  return out;
}

export async function POST(req: Request) {
  if (!ADMIN_SEED_TOKEN) {
    return NextResponse.json(
      { error: "ADMIN_SEED_TOKEN not set" },
      { status: 500 },
    );
  }
  const token = req.headers.get("x-admin-token") || "";
  if (token !== ADMIN_SEED_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseEN = getDict("en"); // your English source-of-truth
    const flatEN = flatten(baseEN);

    const locales = SUP_LOCALES.filter((l) => l !== "en");
    let created = 0;
    let skipped = 0;
    let errors: Array<{ key: string; locale: string; error: string }> = [];

    for (const locale of locales) {
      for (const [key, enVal] of Object.entries(flatEN)) {
        try {
          const existing = await getKey(locale, key, "app");
          if (existing?.text) {
            skipped++;
            continue;
          }
          const translated = await deeplTranslate(enVal, locale, {
            sourceLang: "EN",
          });
          await putKey(locale, key, String(translated), "app");
          created++;
        } catch (e: any) {
          errors.push({ key, locale, error: e?.message ?? "unknown" });
        }
      }
    }

    return NextResponse.json({ ok: true, created, skipped, locales, errors });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "seed-fail" },
      { status: 500 },
    );
  }
}
