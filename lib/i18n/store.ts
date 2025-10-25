import "server-only";
import crypto from "crypto";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE } = process.env;

async function adminFetch(path: string, init?: RequestInit) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error("Supabase service env missing");
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    throw new Error(`Supabase error ${res.status}: ${t}`);
  }
  return res.json();
}

// UI keys
export async function getKey(locale: string, tkey: string, namespace = "app") {
  const url = new URL("/rest/v1/i18n_translations", SUPABASE_URL);
  url.searchParams.set("select", "*");
  url.searchParams.set("locale", `eq.${locale}`);
  url.searchParams.set("tkey", `eq.${tkey}`);
  url.searchParams.set("namespace", `eq.${namespace}`);

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
    },
    cache: "no-store",
  });

  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] || null;
}

export async function putKey(
  locale: string,
  tkey: string,
  text: string,
  namespace = "app",
) {
  return adminFetch("i18n_translations", {
    method: "POST",
    body: JSON.stringify([{ locale, tkey, text, namespace }]),
  });
}

// Dynamic content (names, descriptions...)
export function hashDynamic(
  sourceLang: string,
  targetLang: string,
  raw: string,
) {
  return crypto
    .createHash("sha1")
    .update([sourceLang, targetLang, raw].join("|"))
    .digest("hex");
}

export async function getDynamic(locale: string, contentHash: string) {
  const url = new URL("/rest/v1/i18n_dynamic", SUPABASE_URL);
  url.searchParams.set("select", "*");
  url.searchParams.set("locale", `eq.${locale}`);
  url.searchParams.set("content_hash", `eq.${contentHash}`);

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
    },
    cache: "no-store",
  });

  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] || null;
}

export async function putDynamic(
  locale: string,
  contentHash: string,
  text: string,
) {
  return adminFetch("i18n_dynamic", {
    method: "POST",
    body: JSON.stringify([{ locale, content_hash: contentHash, text }]),
  });
}
