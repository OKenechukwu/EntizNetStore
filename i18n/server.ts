// i18n/server.ts
import { cookies } from "next/headers";
import { DICTS } from "@/i18n/dictionaries";

function clamp(lc?: string) {
  const supported = (process.env.NEXT_PUBLIC_SUPPORTED_LOCALES || "en")
    .split(",")
    .map((s) => s.trim().toLowerCase());
  const v = (lc || "en").split("-")[0].toLowerCase();
  return supported.includes(v) ? v : "en";
}

function getFromDict(dict: any, key: string) {
  return key
    .split(".")
    .reduce<any>((a, p) => (a && a[p] != null ? a[p] : undefined), dict);
}

export async function getServerI18n() {
  const c = await cookies();
  const cookieLocale = c.get("locale")?.value || "en";
  const locale = clamp(cookieLocale);
  const dict = (DICTS as any)[locale] ?? (DICTS as any).en;

  const t = (k: string) => {
    const hit = getFromDict(dict, k);
    if (typeof hit === "string") return hit;
    const bare = (dict as any)[k];
    if (typeof bare === "string") return bare;
    return k; // show the key if missing
  };

  return { locale, dict, t };
}
