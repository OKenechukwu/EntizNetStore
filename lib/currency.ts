// lib/currency.ts
export const BASE_CURRENCY = "USD";
export const DEFAULT_CURRENCY = "USD";

/**
 * A broad, practical set of ISO-4217 currency codes shown in the picker.
 * Frankfurter covers most of these; for any it doesn’t, we fall back
 * to STATIC_RATES_BY_BASE so the app still works.
 */
export const SUPPORTED_CURRENCIES: string[] = [
  "USD", // US Dollar - World's primary reserve currency
  "EUR", // Euro - European Union
  "GBP", // British Pound
  "JPY", // Japanese Yen
  "CNY", // Chinese Yuan
  "AUD", // Australian Dollar
  "CAD", // Canadian Dollar
  "CHF", // Swiss Franc
  "HKD", // Hong Kong Dollar
  "SGD", // Singapore Dollar
  "INR", // Indian Rupee
  "KRW", // South Korean Won
  "MXN", // Mexican Peso
  "BRL", // Brazilian Real
  "ZAR", // South African Rand
  "TRY", // Turkish Lira
  "RUB", // Russian Ruble
  "PHP", // Philippine Peso
  "NGN", // Nigerian Naira
  "THB", // Thai Baht
];

/**
 * Currency display names with symbols
 */
export const CURRENCY_NAMES: Record<string, { name: string; symbol: string }> = {
  USD: { name: "US Dollar", symbol: "$" },
  EUR: { name: "Euro", symbol: "€" },
  GBP: { name: "British Pound", symbol: "£" },
  JPY: { name: "Japanese Yen", symbol: "¥" },
  CNY: { name: "Chinese Yuan", symbol: "¥" },
  AUD: { name: "Australian Dollar", symbol: "A$" },
  CAD: { name: "Canadian Dollar", symbol: "C$" },
  CHF: { name: "Swiss Franc", symbol: "Fr" },
  HKD: { name: "Hong Kong Dollar", symbol: "HK$" },
  SGD: { name: "Singapore Dollar", symbol: "S$" },
  INR: { name: "Indian Rupee", symbol: "₹" },
  KRW: { name: "South Korean Won", symbol: "₩" },
  MXN: { name: "Mexican Peso", symbol: "MX$" },
  BRL: { name: "Brazilian Real", symbol: "R$" },
  ZAR: { name: "South African Rand", symbol: "R" },
  TRY: { name: "Turkish Lira", symbol: "₺" },
  RUB: { name: "Russian Ruble", symbol: "₽" },
  PHP: { name: "Philippine Peso", symbol: "₱" },
  NGN: { name: "Nigerian Naira", symbol: "₦" },
  THB: { name: "Thai Baht", symbol: "฿" },
};

/**
 * Fallback static rates (rough dev values) used when the live API
 * fails or doesn’t include a given currency. Update periodically.
 * Prices in DB are stored in BASE_CURRENCY (USD).
 */
const STATIC_RATES_BY_BASE: Record<string, Record<string, number>> = {
  USD: {
    // self
    USD: 1,

    // Top 20 currencies
    EUR: 0.92,
    GBP: 0.78,
    JPY: 157,
    CNY: 7.3,
    AUD: 1.49,
    CAD: 1.36,
    CHF: 0.86,
    HKD: 7.8,
    SGD: 1.35,
    INR: 84,
    KRW: 1380,
    MXN: 19.0,
    BRL: 5.2,
    ZAR: 18.5,
    TRY: 34,
    RUB: 92,
    PHP: 58,
    NGN: 1600,
    THB: 36,
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
