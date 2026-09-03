import { CURRENCY_COOKIE, LEGACY_CURRENCY_KEYS } from "@/lib/preferences";

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

export type SupportedCurrency = CurrencyCode;
export const SUPPORTED_CURRENCIES: readonly CurrencyCode[] = [
  "USD", "EUR", "GBP", "JPY", "CNY", "PHP", "AUD", "CAD", "NGN", "GHS", "ZAR", "INR", "BRL",
] as const;

export const BASE_CURRENCY: CurrencyCode = "USD";
export const DEFAULT_CURRENCY: CurrencyCode = "USD";
const FX_STORAGE_KEY = "entiz_fx_rates_v2";
const FX_STORAGE_TS_KEY = "entiz_fx_rates_ts_v2";
const FX_MAX_AGE_MS = 1000 * 60 * 60 * 6;

export type FxRates = Record<CurrencyCode, number> & {
  __base?: CurrencyCode;
  __asOf?: string;
  __source?: "live" | "cache" | "static-fallback";
};

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
  __source: "static-fallback",
};

export function toCurrencyCode(value?: string | null): CurrencyCode {
  const normalized = (value ?? "").toUpperCase().trim();
  return SUPPORTED_CURRENCIES.includes(normalized as CurrencyCode)
    ? (normalized as CurrencyCode)
    : DEFAULT_CURRENCY;
}

export function isValidFxRates(value: unknown): value is FxRates {
  if (!value || typeof value !== "object") return false;
  const table = value as Record<string, unknown>;
  if (table.__base != null && table.__base !== BASE_CURRENCY) return false;
  return SUPPORTED_CURRENCIES.every((currency) => {
    const rate = table[currency];
    return typeof rate === "number" && Number.isFinite(rate) && rate > 0;
  }) && table.USD === 1;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function readCookie(name: string): string | null {
  if (!isBrowser()) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getActiveCurrency(): CurrencyCode {
  const canonical = readCookie(CURRENCY_COOKIE);
  if (canonical) return toCurrencyCode(canonical);
  for (const legacy of LEGACY_CURRENCY_KEYS) {
    const value = readCookie(legacy);
    if (value) return toCurrencyCode(value);
  }
  return DEFAULT_CURRENCY;
}

export function setActiveCurrency(currency: CurrencyCode) {
  if (!isBrowser()) return;
  document.cookie = `${CURRENCY_COOKIE}=${encodeURIComponent(currency)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  for (const legacy of LEGACY_CURRENCY_KEYS) {
    document.cookie = `${legacy}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export function getStoredFxRates(): FxRates | null {
  if (!isBrowser()) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(FX_STORAGE_KEY) || "null") as unknown;
    return isValidFxRates(parsed) ? { ...parsed, __source: "cache" } : null;
  } catch {
    return null;
  }
}

export function saveFxRates(rates: FxRates) {
  if (!isBrowser() || !isValidFxRates(rates)) return;
  try {
    localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(rates));
    localStorage.setItem(FX_STORAGE_TS_KEY, String(Date.now()));
  } catch {}
}

function isRatesFresh(): boolean {
  if (!isBrowser()) return false;
  const timestamp = Number(localStorage.getItem(FX_STORAGE_TS_KEY));
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
  const age = Date.now() - timestamp;
  return age >= 0 && age <= FX_MAX_AGE_MS;
}

async function fetchLiveFxRates(): Promise<FxRates | null> {
  if (!isBrowser()) return null;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch("/api/fx", {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      base?: string;
      date?: string;
      rates?: unknown;
      source?: string;
    };
    const candidate = {
      ...(payload.rates as object),
      __base: payload.base,
      __asOf: payload.date,
      __source: "live",
    } as FxRates;
    if (!isValidFxRates(candidate)) return null;
    saveFxRates(candidate);
    return candidate;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function getFxRates(options: { refresh?: boolean } = {}): Promise<FxRates> {
  const stored = getStoredFxRates();
  if (!options.refresh && stored && isRatesFresh()) return stored;
  const live = await fetchLiveFxRates();
  if (live) return live;
  if (stored) return stored;
  return FALLBACK_RATES;
}

function requireRate(table: FxRates, currency: CurrencyCode): number {
  const rate = table[currency];
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Missing FX rate for ${currency}`);
  }
  return rate;
}

export function convertFromBase(amount: number, target: CurrencyCode, rates: FxRates = FALLBACK_RATES): number {
  if (!Number.isFinite(amount)) throw new Error("Invalid money amount");
  if (target === BASE_CURRENCY) return roundMoney(amount);
  return roundMoney(amount * requireRate(rates, target));
}

export function convert(amount: number, from: CurrencyCode, to: CurrencyCode, rates: FxRates = FALLBACK_RATES): number {
  if (!Number.isFinite(amount)) throw new Error("Invalid money amount");
  if (from === to) return roundMoney(amount);
  const baseAmount = from === BASE_CURRENCY ? amount : amount / requireRate(rates, from);
  return to === BASE_CURRENCY ? roundMoney(baseAmount) : roundMoney(baseAmount * requireRate(rates, to));
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatPrice(amount: number, currency: CurrencyCode, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale || undefined, {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function convertAndFormatFromBase(
  amountInBase: number,
  options: { currency: CurrencyCode; rates?: FxRates; locale?: string },
): string {
  return formatPrice(
    convertFromBase(amountInBase, options.currency, options.rates || FALLBACK_RATES),
    options.currency,
    options.locale,
  );
}

export const formatMoney = formatPrice;
