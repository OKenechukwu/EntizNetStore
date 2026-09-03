import { NextResponse } from "next/server";
import {
  BASE_CURRENCY,
  SUPPORTED_CURRENCIES,
  isValidFxRates,
  type CurrencyCode,
  type FxRates,
} from "@/lib/currency";

export const dynamic = "force-dynamic";

const FX_ORIGIN = "https://api.frankfurter.dev";
const FX_MAX_RESPONSE_BYTES = 32 * 1024;
const FX_TIMEOUT_MS = 4_000;
const QUOTES = SUPPORTED_CURRENCIES.filter((currency) => currency !== BASE_CURRENCY);

type FrankfurterRate = {
  date?: string;
  base?: string;
  quote?: string;
  rate?: number;
};

function failure(status = 503) {
  return NextResponse.json(
    { error: "FX rates temporarily unavailable" },
    { status, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

export async function GET() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FX_TIMEOUT_MS);
  try {
    const url = new URL("/v2/rates", FX_ORIGIN);
    url.searchParams.set("base", BASE_CURRENCY);
    url.searchParams.set("quotes", QUOTES.join(","));

    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) return failure();
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) return failure();
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > FX_MAX_RESPONSE_BYTES) return failure();

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > FX_MAX_RESPONSE_BYTES) return failure();
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!Array.isArray(payload)) return failure();

    const rates = { USD: 1 } as Partial<Record<CurrencyCode, number>>;
    let asOf: string | undefined;
    for (const row of payload as FrankfurterRate[]) {
      if (row.base !== BASE_CURRENCY || typeof row.quote !== "string") return failure();
      if (!QUOTES.includes(row.quote as CurrencyCode)) continue;
      if (typeof row.rate !== "number" || !Number.isFinite(row.rate) || row.rate <= 0) return failure();
      rates[row.quote as CurrencyCode] = row.rate;
      if (row.date && (!asOf || row.date < asOf)) asOf = row.date;
    }

    const candidate = {
      ...rates,
      __base: BASE_CURRENCY,
      __asOf: asOf,
      __source: "live",
    } as FxRates;
    if (!isValidFxRates(candidate)) return failure();

    return NextResponse.json(
      {
        base: BASE_CURRENCY,
        rates: Object.fromEntries(SUPPORTED_CURRENCIES.map((currency) => [currency, candidate[currency]])),
        date: asOf,
        source: "frankfurter-v2",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=10800, stale-while-revalidate=21600, max-age=900",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch {
    return failure();
  } finally {
    clearTimeout(timeout);
  }
}
