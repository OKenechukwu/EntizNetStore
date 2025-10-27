// components/ui/Price.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useCurrency } from "@/components/currency/CurrencyProvider";

type FxRates = Record<string, number> | null | undefined;

type Props = {
  amountUSD?: number | string | null | undefined; // main prop
  amount?: number | string | null | undefined; // backward compat
  rates?: FxRates; // optional; auto-fetch if missing
  className?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

/** Normalize things like "£ GBP" → "GBP" */
function normalizeCode(input?: string | null): string {
  if (!input) return "USD";
  const match = String(input)
    .toUpperCase()
    .match(/[A-Z]{3}/);
  return match ? match[0] : "USD";
}

/** Safe numeric parse: handles undefined/null, "$39.17", "39,17", etc. */
function toNumberUSD(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v)
    .trim()
    .replace(/[^0-9.,-]/g, "")
    .replace(/,/g, ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

const ZERO_DECIMAL = new Set(["JPY", "KRW"]);

// Shared cache across all <Price/> renders in this session
let cachedRates: Record<string, number> | null = null;
let inflight: Promise<Record<string, number> | null> | null = null;

/** Fetch live FX rates once (cached in-memory for all <Price/> components) */
async function loadRatesOnce(): Promise<Record<string, number> | null> {
  if (cachedRates) return cachedRates;
  if (inflight) return inflight;

  inflight = fetch("/api/fx", { cache: "no-store" })
    .then((res) => res.json())
    .then((j) =>
      j?.rates && typeof j.rates === "object" ? (cachedRates = j.rates) : null,
    )
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export default function Price({
  amountUSD,
  amount, // alias
  rates,
  className,
  minimumFractionDigits,
  maximumFractionDigits,
}: Props) {
  const { locale } = useI18n();
  const { currency: currencyFromProvider, rates: currencyRates } = useCurrency();
  
  const code = normalizeCode(currencyFromProvider);
  const base = toNumberUSD(amountUSD ?? amount);

  const [autoRates, setAutoRates] = useState<Record<string, number> | null>(
    cachedRates,
  );

  // Auto-fetch only once per session if no rates provided from CurrencyProvider
  useEffect(() => {
    if (!rates && !currencyRates && !autoRates) {
      loadRatesOnce().then((r) => {
        if (r) setAutoRates(r);
      });
    }
  }, [rates, currencyRates, autoRates]);

  // Use passed rates → CurrencyProvider rates → cached auto → fallback
  const effectiveRates = rates ?? currencyRates ?? autoRates ?? { USD: 1 };

  const rawRate = code === "USD" ? 1 : effectiveRates?.[code];
  const rate =
    typeof rawRate === "number" && isFinite(rawRate) && rawRate > 0
      ? rawRate
      : 1;

  const { value, fracMin, fracMax } = useMemo(() => {
    const converted = base * rate;
    const zeroDec = ZERO_DECIMAL.has(code);
    return {
      value: Number.isFinite(converted) ? converted : 0,
      fracMin: minimumFractionDigits ?? (zeroDec ? 0 : 2),
      fracMax: maximumFractionDigits ?? (zeroDec ? 0 : 2),
    };
  }, [base, rate, code, minimumFractionDigits, maximumFractionDigits]);

  const formatted = useMemo(() => {
    try {
      return new Intl.NumberFormat(locale || "en-US", {
        style: "currency",
        currency: code,
        minimumFractionDigits: fracMin,
        maximumFractionDigits: fracMax,
      }).format(value);
    } catch {
      return `${code} ${value.toFixed(fracMax)}`;
    }
  }, [value, code, locale, fracMin, fracMax]);

  return <span className={className}>{formatted}</span>;
}
