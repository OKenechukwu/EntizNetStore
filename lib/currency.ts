// lib/currency.ts
export const BASE_CURRENCY = "USD";
export const DEFAULT_CURRENCY = "USD";

/**
 * A broad, practical set of ISO-4217 currency codes shown in the picker.
 * Frankfurter covers most of these; for any it doesn’t, we fall back
 * to STATIC_RATES_BY_BASE so the app still works.
 */
export const SUPPORTED_CURRENCIES: string[] = [
  // Europe
  "EUR",
  "GBP",
  "CHF",
  "DKK",
  "NOK",
  "SEK",
  "PLN",
  "CZK",
  "HUF",
  "RON",
  // Americas
  "USD",
  "CAD",
  "MXN",
  "BRL",
  "ARS",
  "CLP",
  "COP",
  // Asia-Pacific
  "JPY",
  "CNY",
  "HKD",
  "TWD",
  "KRW",
  "SGD",
  "AUD",
  "NZD",
  "INR",
  "IDR",
  "MYR",
  "PHP",
  "THB",
  "VND",
  // Middle East / Africa
  "AED",
  "SAR",
  "TRY",
  "ZAR",
  "NGN",
  "EGP",
  "KES",
];

/**
 * Fallback static rates (rough dev values) used when the live API
 * fails or doesn’t include a given currency. Update periodically.
 * Prices in DB are stored in BASE_CURRENCY (USD).
 */
const STATIC_RATES_BY_BASE: Record<string, Record<string, number>> = {
  USD: {
    // self
    USD: 1,

    // Europe
    EUR: 0.92,
    GBP: 0.78,
    CHF: 0.86,
    DKK: 6.87,
    NOK: 10.5,
    SEK: 10.6,
    PLN: 3.95,
    CZK: 23.2,
    HUF: 360,
    RON: 4.6,

    // Americas
    CAD: 1.36,
    MXN: 19.0,
    BRL: 5.2,
    ARS: 950,
    CLP: 950,
    COP: 4000,

    // Asia-Pacific
    JPY: 157,
    CNY: 7.3,
    HKD: 7.8,
    TWD: 32,
    KRW: 1380,
    SGD: 1.35,
    AUD: 1.49,
    NZD: 1.65,
    INR: 84,
    IDR: 16000,
    MYR: 4.7,
    PHP: 58,
    THB: 36,
    VND: 25500,

    // Middle East / Africa
    AED: 3.67,
    SAR: 3.75,
    TRY: 34,
    ZAR: 18.5,
    NGN: 1600,
    EGP: 50,
    KES: 130,
  },
};

type FxCache = {
  base: string;
  ts: number;
  rates: Record<string, number>;
};

declare global {
  // eslint-disable-next-line no-var
  var __fxCache: FxCache | undefined;
}

/**
 * Fetch FX rates for a base currency and cache them in memory for 1 hour.
 * We MERGE fallback + live so missing currencies still convert.
 */
export async function getFxRates(
  base: string,
  maxAgeMs = 60 * 60 * 1000, // 1 hour
): Promise<Record<string, number>> {
  const now = Date.now();

  // Serve from in-memory cache if fresh
  if (
    globalThis.__fxCache &&
    globalThis.__fxCache.base === base &&
    now - globalThis.__fxCache.ts < maxAgeMs
  ) {
    return globalThis.__fxCache.rates;
  }

  // Fallback map (covers currencies not always in the live API)
  const fallback: Record<string, number> = {
    [base]: 1,
    ...(STATIC_RATES_BY_BASE[base] || {}),
  };

  try {
    // Frankfurter (no API key required)
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}`,
      { next: { revalidate: 3600 } },
    );

    if (res.ok) {
      const json: any = await res.json();
      const live: Record<string, number> = json?.rates || {};

      // Merge: fallback first, then live (live wins where present)
      const merged: Record<string, number> = { ...fallback, ...live };

      globalThis.__fxCache = { base, ts: now, rates: merged };
      return merged;
    }
  } catch {
    // ignore; we'll return fallback below
  }

  globalThis.__fxCache = { base, ts: now, rates: fallback };
  return fallback;
}

/** Convert an amount from BASE_CURRENCY into target currency using rates */
export function convertFromBase(
  amount: number,
  targetCurrency: string,
  rates: Record<string, number>,
): number {
  const rate = rates[targetCurrency] ?? 1;
  return round(amount * rate);
}

/** Convert an amount typed in sourceCurrency back to BASE_CURRENCY using rates */
export function convertToBase(
  amount: number,
  sourceCurrency: string,
  rates: Record<string, number>,
): number {
  const rate = rates[sourceCurrency] ?? 1;
  if (!rate || rate <= 0) return amount;
  return round(amount / rate);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
