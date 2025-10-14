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

export function convertFromBase(
  amount: number,
  targetCurrency: SupportedCurrency,
  rates: Record<string, number>,
): number {
  const rate = rates[targetCurrency] ?? 1;
  return round(amount * rate);
}

export function convertToBase(
  amount: number,
  sourceCurrency: SupportedCurrency,
  rates: Record<string, number>,
): number {
  const rate = rates[sourceCurrency] ?? 1;
  if (!rate || rate <= 0) return amount;
  return round(amount / rate);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** ------------------------------------------------------------------
 * Detection helpers (locale/timezone → currency)
 * ------------------------------------------------------------------ */

const LOCALE_TO_CURRENCY: Record<string, SupportedCurrency> = {
  // Americas
  "en-US": "USD",
  "en-CA": "CAD",
  "fr-CA": "CAD",
  "es-MX": "MXN",
  "pt-BR": "BRL",

  // Europe
  "en-GB": "GBP",
  "de-DE": "EUR",
  "fr-FR": "EUR",
  "es-ES": "EUR",
  "it-IT": "EUR",
  "nl-NL": "EUR",
  "pt-PT": "EUR",
  "de-CH": "CHF",
  "fr-CH": "CHF",
  "it-CH": "CHF",
  "tr-TR": "TRY",
  "ru-RU": "RUB",

  // Asia Pacific
  "ja-JP": "JPY",
  "ko-KR": "KRW",
  "zh-CN": "CNY",
  "en-AU": "AUD",
  "en-HK": "HKD",
  "en-SG": "SGD",
  "zh-SG": "SGD",
  "hi-IN": "INR",
  "en-IN": "INR",
  "th-TH": "THB",
  "en-PH": "PHP",
  "tl-PH": "PHP",
  "fil-PH": "PHP",

  // Africa
  "en-NG": "NGN",
  "ha-NG": "NGN",
  "yo-NG": "NGN",
  "en-ZA": "ZAR",
};

const TIMEZONE_TO_CURRENCY: Record<string, SupportedCurrency> = {
  // Americas
  "America/New_York": "USD",
  "America/Chicago": "USD",
  "America/Denver": "USD",
  "America/Los_Angeles": "USD",
  "America/Toronto": "CAD",
  "America/Vancouver": "CAD",
  "America/Mexico_City": "MXN",
  "America/Sao_Paulo": "BRL",

  // Europe
  "Europe/London": "GBP",
  "Europe/Berlin": "EUR",
  "Europe/Paris": "EUR",
  "Europe/Madrid": "EUR",
  "Europe/Rome": "EUR",
  "Europe/Amsterdam": "EUR",
  "Europe/Zurich": "CHF",
  "Europe/Istanbul": "TRY",
  "Europe/Moscow": "RUB",

  // Asia Pacific
  "Asia/Tokyo": "JPY",
  "Asia/Seoul": "KRW",
  "Asia/Shanghai": "CNY",
  "Asia/Hong_Kong": "HKD",
  "Asia/Singapore": "SGD",
  "Asia/Kolkata": "INR",
  "Asia/Bangkok": "THB",
  "Asia/Manila": "PHP",
  "Australia/Sydney": "AUD",
  "Australia/Melbourne": "AUD",

  // Africa
  "Africa/Lagos": "NGN",
  "Africa/Johannesburg": "ZAR",
};

/** Detect likely currency from browser locale/timezone (client only). */
export function detectUserCurrency(): SupportedCurrency {
  if (typeof window === "undefined") return DEFAULT_CURRENCY;

  try {
    const locale = navigator.language || navigator.languages?.[0];

    if (locale && LOCALE_TO_CURRENCY[locale]) {
      const cur = LOCALE_TO_CURRENCY[locale];
      if (SUPPORTED_CURRENCIES.includes(cur)) return cur;
    }

    if (locale) {
      const base = locale.split("-")[0];
      // try to match 'en-*' etc
      for (const [k, cur] of Object.entries(LOCALE_TO_CURRENCY)) {
        if (k.startsWith(`${base}-`) && SUPPORTED_CURRENCIES.includes(cur)) {
          return cur;
        }
      }
    }

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_TO_CURRENCY[tz]) {
      const cur = TIMEZONE_TO_CURRENCY[tz];
      if (SUPPORTED_CURRENCIES.includes(cur)) return cur;
    }

    if (tz) {
      const region = tz.split("/")[0];
      if (region === "America") return "USD";
      if (region === "Europe") return "EUR";
      if (region === "Asia") return "CNY";
      if (region === "Australia") return "AUD";
      if (region === "Africa") return "ZAR";
    }
  } catch {
    // ignore
  }

  return DEFAULT_CURRENCY;
}

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
    }).format(n);
  } catch {
    // Fallback if Intl rejects a combo; use symbol map.
    const symbol = CURRENCY_NAMES[currency]?.symbol ?? "$";
    const value =
      typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : String(n);
    return `${symbol}${value}`;
  }
}
