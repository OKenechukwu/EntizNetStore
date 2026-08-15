// lib/currency.ts
// Phase 1: solid, app-wide currency utils with safe fallbacks + cookies.
// No external calls; you can later plug an /api/fx endpoint if you want live rates.

export type CurrencyCode =
  | "USD"
  | "EUR"
  | "GBP"
  | "JPY"
  | "CNY"
  | "PHP"
  | "AUD"
  | "CAD"
  | "NGN"
  | "GHS"
  | "ZAR"
  | "INR"
  | "BRL";

// For compatibility with callers that import SupportedCurrency
export type SupportedCurrency = CurrencyCode;

export const SUPPORTED_CURRENCIES: CurrencyCode[] = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CNY",
  "PHP",
  "AUD",
  "CAD",
  "NGN",
  "GHS",
  "ZAR",
  "INR",
  "BRL",
];

/**
 * Normalize an arbitrary string (cookie, query, request body) to a supported
 * CurrencyCode, falling back to DEFAULT_CURRENCY.
 */
export function toCurrencyCode(value?: string | null): CurrencyCode {
  const v = (value ?? "").toUpperCase().trim();
  return SUPPORTED_CURRENCIES.includes(v as CurrencyCode)
    ? (v as CurrencyCode)
    : DEFAULT_CURRENCY;
}

// Base is what your DB prices are stored in.
// Keep this consistent across the whole store.
export const BASE_CURRENCY: CurrencyCode = "USD";

// What users see if nothing is chosen yet.
export const DEFAULT_CURRENCY: CurrencyCode = "USD";

// --- Local storage + cookie keys
const FX_STORAGE_KEY = "entiz_fx_rates_v1";
const FX_STORAGE_TS_KEY = "entiz_fx_rates_ts_v1";
const CURRENCY_COOKIE = "currency";
const FX_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24h

export type FxRates = Record<CurrencyCode, number> & {
  // Optional metadata (not required for conversion)
  __base?: CurrencyCode;
  __asOf?: string;
};

// Safe fallback table (1 BASE -> target).
// Keep these reasonable; they’re only used if nothing else is available.
export const FALLBACK_RATES: FxRates = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.78,
  JPY: 151,
  CNY: 7.1,
  PHP: 57,
  AUD: 1.48,
  CAD: 1.36,
  NGN: 1600,
  GHS: 15,
  ZAR: 18.5,
  INR: 84,
  BRL: 5.6,
  __base: BASE_CURRENCY,
  __asOf: "static-fallback",
};

// ---------- Small helpers
function isBrowser() {
  return typeof window !== "undefined";
}

function readCookie(name: string): string | null {
  if (!isBrowser()) return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, days = 365) {
  if (!isBrowser()) return;
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
}

// ---------- Active currency (user-chosen)
export function getActiveCurrency(): CurrencyCode {
  const c = readCookie(CURRENCY_COOKIE);
  if (c && SUPPORTED_CURRENCIES.includes(c as CurrencyCode)) {
    return c as CurrencyCode;
  }
  return DEFAULT_CURRENCY;
}

export function setActiveCurrency(c: CurrencyCode) {
  writeCookie(CURRENCY_COOKIE, c);
}

// ---------- Rates storage
export function getStoredFxRates(): FxRates | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(FX_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FxRates;
  } catch {
    return null;
  }
}

export function saveFxRates(rates: FxRates) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(rates));
    localStorage.setItem(FX_STORAGE_TS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function isRatesFresh(): boolean {
  if (!isBrowser()) return false;
  const ts = localStorage.getItem(FX_STORAGE_TS_KEY);
  if (!ts) return false;
  const age = Date.now() - Number(ts);
  return age >= 0 && age <= FX_MAX_AGE_MS;
}

// ---------- Public API

/**
 * Returns FX rates with this contract: 1 BASE -> target.
 * For now, we use stored (or fallback) rates. In Phase 1B, you can
 * wire an /api/fx endpoint and then call it here to refresh live rates.
 */
export async function getFxRates(): Promise<FxRates> {
  // Prefer fresh stored rates
  const stored = getStoredFxRates();
  if (stored && isRatesFresh()) return stored;

  // If stored but stale, we still return it (better than nothing),
  // but we do not block on network here.
  if (stored) return stored;

  // Otherwise, fallback
  return FALLBACK_RATES;
}

/**
 * Convert an amount that is stored in BASE_CURRENCY to target currency.
 * If target equals base, returns the original amount.
 */
export function convertFromBase(
  amount: number,
  target: CurrencyCode,
  rates?: FxRates
): number {
  const table = rates ?? FALLBACK_RATES;
  if (target === BASE_CURRENCY) return roundMoney(amount);
  const r = table[target];
  if (!r || r <= 0) return roundMoney(amount);
  return roundMoney(amount * r);
}

/**
 * Convert from any currency to any other using the base as a bridge.
 */
export function convert(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates?: FxRates
): number {
  const table = rates ?? FALLBACK_RATES;
  if (from === to) return roundMoney(amount);
  if (from === BASE_CURRENCY) return convertFromBase(amount, to, table);
  if (to === BASE_CURRENCY) {
    // from -> base
    const r = table[from];
    if (!r || r <= 0) return roundMoney(amount);
    return roundMoney(amount / r);
  }
  // from -> base -> to
  const toBase = convert(amount, from, BASE_CURRENCY, table);
  return convertFromBase(toBase, to, table);
}

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Format a price using Intl.NumberFormat.
 * Locale is optional: if not provided, it will use the browser default.
 */
export function formatPrice(
  amount: number,
  currency: CurrencyCode,
  locale?: string
): string {
  try {
    return new Intl.NumberFormat(locale || undefined, {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Extremely rare fallback
    const sym = currencySymbol(currency);
    return `${sym}${amount.toFixed(2)}`;
  }
}

/**
 * Convenience: convert from BASE to target and format in one call.
 * Useful for components that have prices stored in BASE (USD).
 */
export function convertAndFormatFromBase(
  amountInBase: number,
  opts: {
    currency: CurrencyCode;
    rates?: FxRates;
    locale?: string;
  }
): string {
  const converted = convertFromBase(amountInBase, opts.currency, opts.rates);
  return formatPrice(converted, opts.currency, opts.locale);
}

function currencySymbol(c: CurrencyCode): string {
  switch (c) {
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "JPY":
      return "¥";
    case "CNY":
      return "¥";
    case "PHP":
      return "₱";
    case "AUD":
      return "A$";
    case "CAD":
      return "C$";
    case "NGN":
      return "₦";
    case "GHS":
      return "₵";
    case "ZAR":
      return "R";
    case "INR":
      return "₹";
    case "BRL":
      return "R$";
    default:
      return "";
  }
}

/**
 * Alias for formatPrice - used by SettingsProvider
 */
export const formatMoney = formatPrice;
