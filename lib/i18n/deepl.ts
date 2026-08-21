// lib/i18n/deepl.ts

// server-only
import "server-only";

type DeeplOpts = {
  sourceLang?: string; // e.g. 'EN'
  formality?: "default" | "prefer_more" | "prefer_less";
  preserveFormatting?: boolean;
};

// Choose default endpoint by plan; allow manual override via URL/HOST
const PLAN = (process.env.DEEPL_PLAN || "pro").toLowerCase() as "pro" | "free";
const DEFAULT_PRO = "https://api.deepl.com/v2/translate";
const DEFAULT_FREE = "https://api-free.deepl.com/v2/translate";
const DEFAULT_API = PLAN === "free" ? DEFAULT_FREE : DEFAULT_PRO;

// ⬇️ pick up either DEEPL_API_URL or DEEPL_API_HOST, fallback to default
const ENDPOINT_OVERRIDE =
  process.env.DEEPL_API_URL || process.env.DEEPL_API_HOST || "";
let ENDPOINT = ENDPOINT_OVERRIDE || DEFAULT_API;

// Small helper: backoff for 429s
async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function shouldFlipEndpoint(errBody: string) {
  return (
    /Wrong endpoint/i.test(errBody) ||
    /use https:\/\/api(-free)?\.deepl\.com/i.test(errBody)
  );
}

export async function deeplTranslate(
  text: string | string[],
  targetLang: string,
  opts: DeeplOpts = {},
): Promise<string | string[]> {
  // Resolve and validate credentials at request time. Throwing during module
  // import prevents Next.js from collecting route data in environments where
  // translation is intentionally not configured (for example CI builds).
  const authKey = process.env.DEEPL_AUTH_KEY || process.env.DEEPL_API_KEY || "";
  if (!authKey) {
    throw new Error(
      "Missing DeepL API key. Set DEEPL_AUTH_KEY or DEEPL_API_KEY in the deployment environment",
    );
  }

  const payload = new URLSearchParams();
  const inputs = Array.isArray(text) ? text : [text];

  for (const t of inputs) payload.append("text", t);
  payload.set("target_lang", targetLang.toUpperCase());
  if (opts.sourceLang)
    payload.set("source_lang", opts.sourceLang.toUpperCase());
  if (opts.formality) payload.set("formality", opts.formality);
  if (opts.preserveFormatting) payload.set("preserve_formatting", "1");

  // Up to 5 attempts: handle 429 and one 403 flip
  let flippedOnce = false;

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${authKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload.toString(),
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      const out = data?.translations?.map((t: any) => t.text) ?? inputs;
      return Array.isArray(text) ? out : out[0];
    }

    const errText = await res.text().catch(() => res.statusText);

    // 403: wrong endpoint for key → flip once between pro/free and retry
    if (res.status === 403 && !flippedOnce && shouldFlipEndpoint(errText)) {
      ENDPOINT = ENDPOINT.includes("api-free") ? DEFAULT_PRO : DEFAULT_FREE;
      flippedOnce = true;
      continue;
    }

    // 429: Too many requests → exponential backoff or honor Retry-After
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After"));
      if (!Number.isNaN(retryAfter) && retryAfter > 0) {
        await sleep(retryAfter * 1000);
      } else {
        const delay =
          Math.min(1000 * 2 ** attempt, 8000) + Math.floor(Math.random() * 250);
        await sleep(delay);
      }
      continue;
    }

    // 5xx: transient—retry with small backoff
    if (res.status >= 500) {
      const delay = Math.min(1000 * 2 ** attempt, 8000);
      await sleep(delay);
      continue;
    }

    // Non-retryable
    throw new Error(`DeepL error ${res.status}: ${errText}`);
  }

  throw new Error(
    "DeepL translate failed after retries (429/403/5xx). Please try again.",
  );
}
