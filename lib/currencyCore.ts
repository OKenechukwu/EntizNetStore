export const SUPPORTED_CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CNY", "PHP", "AUD", "CAD", "NGN", "GHS", "ZAR", "INR", "BRL",
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];
export type SupportedCurrency = CurrencyCode;
export type FxRates = Record<CurrencyCode, number>;
export type FxSnapshot = {
  base: CurrencyCode;
  rates: FxRates;
  asOf: string;
  source: "live" | "cache" | "fallback";
  stale: boolean;
};

export const BASE_CURRENCY: CurrencyCode = "USD";
export const DEFAULT_CURRENCY: CurrencyCode = "USD";

export const FALLBACK_RATES: FxRates = Object.freeze({
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
});

export function toCurrencyCode(value?: string | null): CurrencyCode {
  const normalized = (value || "").trim().toUpperCase();
  return SUPPORTED_CURRENCIES.includes(normalized as CurrencyCode)
    ? (normalized as CurrencyCode)
    : DEFAULT_CURRENCY;
}

export function coerceFxRates(value: unknown): FxRates | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const rates = {} as FxRates;
  for (const code of SUPPORTED_CURRENCIES) {
    const rate = source[code];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return null;
    rates[code] = rate;
  }
  if (Math.abs(rates[BASE_CURRENCY] - 1) > Number.EPSILON) return null;
  return rates;
}

export function getSafeRate(
  currency: CurrencyCode,
  rates?: Partial<Record<CurrencyCode, number>> | null,
): number {
  if (currency === BASE_CURRENCY) return 1;
  const candidate = rates?.[currency];
  return typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0
    ? candidate
    : FALLBACK_RATES[currency];
}

export function convertFromBase(
  amount: number,
  target: CurrencyCode,
  rates?: Partial<Record<CurrencyCode, number>> | null,
): number {
  if (target === BASE_CURRENCY) return roundMoney(amount);
  return roundMoney(amount * getSafeRate(target, rates));
}

export function convert(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates?: Partial<Record<CurrencyCode, number>> | null,
): number {
  if (from === to) return roundMoney(amount);
  if (from === BASE_CURRENCY) return convertFromBase(amount, to, rates);
  const amountInBase = roundMoney(amount / getSafeRate(from, rates));
  return to === BASE_CURRENCY ? amountInBase : convertFromBase(amountInBase, to, rates);
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
      maximumFractionDigits: currency === "JPY" ? 0 : 2,
      minimumFractionDigits: currency === "JPY" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(currency === "JPY" ? 0 : 2)}`;
  }
}

export function convertAndFormatFromBase(
  amountInBase: number,
  options: { currency: CurrencyCode; rates?: Partial<Record<CurrencyCode, number>> | null; locale?: string },
): string {
  return formatPrice(
    convertFromBase(amountInBase, options.currency, options.rates),
    options.currency,
    options.locale,
  );
}

export const formatMoney = formatPrice;
