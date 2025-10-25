// lib/currency.ts

/** ------------------------------------------------------------------
 * Currency constants & types
 * ------------------------------------------------------------------ */

export const BASE_CURRENCY = "USD" as const;

// Keep the list tight but practical for your market.
// Add/remove codes here and the union type updates automatically.
export const SUPPORTED_CURRENCIES = [
  "USD", // US Dollar
  "EUR", // Euro
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
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: SupportedCurrency = "USD";

/** Display names & symbols (used for fallbacks / UI labels) */
export const CURRENCY_NAMES: Record<
  SupportedCurrency,
  { name: string; symbol: string }
> = {
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

/** Minor units (decimal places) for display & rounding */
export const MINOR_UNITS: Record<SupportedCurrency, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0, // no minor unit
  CNY: 2,
  AUD: 2,
  CAD: 2,
  CHF: 2,
  HKD: 2,
  SGD: 2,
  INR: 2,
  KRW: 0, // usually displayed as whole won
  MXN: 2,
  BRL: 2,
  ZAR: 2,
  TRY: 2,
  RUB: 2,
  PHP: 2,
  NGN: 2,
  THB: 2,
};

/** ------------------------------------------------------------------
 * Fallback static FX rates (rough dev values).
 * DB prices are assumed to be stored in BASE_CURRENCY (USD).
 * ------------------------------------------------------------------ */
const STATIC_RATES_BY_BASE: Record<
  SupportedCurrency,
  Partial<Record<SupportedCurrency, number>>
> = {
  USD: {
    USD: 1,
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
  // If you later store in other bases, add blocks here.
} as const;

/** ------------------------------------------------------------------
 * Live FX fetch + cache (Frankfurter, no API key)
 * ------------------------------------------------------------------ */

type FxCache = {
  base: SupportedCurrency;
  ts: number;
  rates: Record<string, number>;
};

declare global {
  // eslint-disable-next-line no-var
  var __fxCache: FxCache | undefined;
}

/**
 * Fetch rates for a base currency and cache for 1 hour.
 * We MERGE fallback + live so missing currencies still convert.
 */
export async function getFxRates(
  base: SupportedCurrency = BASE_CURRENCY,
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

  // Fallback map (covers currencies not always in live API)
  const fallback: Record<string, number> = {
    [base]: 1,
    ...(STATIC_RATES_BY_BASE[base] || {}),
  };

  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}`,
      // Next.js: cache on server for 1 hour
      { next: { revalidate: 3600 } },
    );

    if (res.ok) {
      const json: any = await res.json();
      const live: Record<string, number> = json?.rates || {};
      const merged = { ...fallback, ...live };

      globalThis.__fxCache = { base, ts: now, rates: merged };
      return merged;
    }
  } catch {
    // ignore; we’ll use fallback
  }

  globalThis.__fxCache = { base, ts: now, rates: fallback };
  return fallback;
}

/** ------------------------------------------------------------------
 * Conversions
 * ------------------------------------------------------------------ */

/**
 * Convert FROM BASE (USD) TO target.
 * (This is the most common direction in EntizNetStore.)
 */
export function convertBaseTo(
  amountInBase: number,
  targetCurrency: SupportedCurrency,
  rates: Record<string, number>,
): number {
  const rate = rates[targetCurrency] ?? 1;
  return roundToMinorUnits(amountInBase * rate, targetCurrency);
}

/** Generic: convert from base map perspective */
export function convertFromBase(
  amount: number,
  targetCurrency: SupportedCurrency,
  rates: Record<string, number>,
): number {
  return convertBaseTo(amount, targetCurrency, rates);
}

/** Convert TO base (USD) FROM any supported currency */
export function convertToBase(
  amount: number,
  sourceCurrency: SupportedCurrency,
  rates: Record<string, number>,
): number {
  const rate = rates[sourceCurrency] ?? 1;
  if (!rate || rate <= 0) return amount;
  // Round in BASE currency (USD uses 2 minor units)
  return roundToMinorUnits(amount / rate, BASE_CURRENCY as SupportedCurrency);
}

/** ------------------------------------------------------------------
 * Rounding / precision helpers
 * ------------------------------------------------------------------ */

function roundToMinorUnits(n: number, currency: SupportedCurrency): number {
  const dp = MINOR_UNITS[currency] ?? 2;
  const m = Math.pow(10, dp);
  return Math.round(n * m) / m;
}

/** ------------------------------------------------------------------
 * REMOVED: Locale/timezone → currency auto-detection
 * Per spec: "Never map locale → currency. Remove any code doing this."
 * Currency selection is now explicit via CurrencyProvider, decoupled from language.
 * ------------------------------------------------------------------ */

/** ------------------------------------------------------------------
 * Single money formatter (used everywhere in UI)
 * ------------------------------------------------------------------ */

export function formatMoney(
  amount: number | string,
  currency: SupportedCurrency = DEFAULT_CURRENCY,
  locale = "en-US",
) {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(n)) return String(amount);

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: MINOR_UNITS[currency] ?? 2,
      minimumFractionDigits: MINOR_UNITS[currency] ?? 2,
    }).format(n);
  } catch {
    // Fallback if Intl rejects a combo; use symbol map.
    const symbol = CURRENCY_NAMES[currency]?.symbol ?? "$";
    const dp = MINOR_UNITS[currency] ?? 2;
    const value =
      typeof n === "number" && Number.isFinite(n) ? n.toFixed(dp) : String(n);
    return `${symbol}${value}`;
  }
}

/** Convenience: convert + format from BASE (USD) in one call */
export function convertAndFormatFromBase(
  amountInBase: number,
  targetCurrency: SupportedCurrency,
  locale = "en-US",
  rates?: Record<string, number>,
) {
  const r = rates ?? STATIC_RATES_BY_BASE[BASE_CURRENCY] ?? {};
  const converted = convertBaseTo(
    amountInBase,
    targetCurrency,
    r as Record<string, number>,
  );
  return formatMoney(converted, targetCurrency, locale);
}
