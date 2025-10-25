// lib/useCurrency.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { useBrand } from "@/components/BrandProvider";

// Keep types local so we don't depend on other files' shapes
export type SupportedCurrency = "USD" | "EUR" | "GBP" | "JPY" | "CNY" | "PHP";

// Base currency = EUR. Amounts passed to format()/convert() are in EUR.
const DEFAULT_CURRENCY: SupportedCurrency = "EUR";

// Lightweight client-side FX table (replace with your server rates anytime)
const DEFAULT_RATES: Record<SupportedCurrency, number> = {
  USD: 1.08, // EUR → USD
  EUR: 1,
  GBP: 0.85,
  JPY: 163,
  CNY: 7.8,
  PHP: 63,
};

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()\[\\]\\/\\+^])/g, "\\$1") + "=([^;]*)")
  );
  return m ? decodeURIComponent(m[1]) : null;
}

export function useCurrency() {
  // Pull brand defaults if you already expose currency/locale there
  const brand = useBrand?.();
  const brandCurrency = (brand?.currency as SupportedCurrency) || undefined;

  const [currency, setCurrency] = useState<SupportedCurrency>(
    brandCurrency || DEFAULT_CURRENCY
  );
  const [rates, setRates] = useState<Record<SupportedCurrency, number>>(DEFAULT_RATES);

  useEffect(() => {
    // Cookie override (e.g., set by your currency switcher)
    const c = readCookie("currency");
    if (c && ["USD", "EUR", "GBP", "JPY", "CNY", "PHP"].includes(c)) {
      setCurrency(c as SupportedCurrency);
    } else if (brandCurrency) {
      setCurrency(brandCurrency);
    }

    // Optional: allow localStorage overrides for rates
    try {
      const ls = localStorage.getItem("entiz_fx_rates");
      if (ls) setRates({ ...DEFAULT_RATES, ...JSON.parse(ls) });
    } catch {
      // ignore
    }
  }, [brandCurrency]);

  const convert = useMemo(() => {
    return (amountInEUR: number) => {
      const rate = rates[currency] ?? 1;
      return amountInEUR * rate;
    };
  }, [currency, rates]);

  const symbol = useMemo(() => {
    switch (currency) {
      case "USD":
        return "$";
      case "EUR":
        return "€";
      case "GBP":
        return "£";
      case "JPY":
      case "CNY":
        return "¥";
      case "PHP":
        return "₱";
      default:
        return "€";
    }
  }, [currency]);

  const format = useMemo(() => {
    return (amountInEUR: number, opts: Intl.NumberFormatOptions = {}) => {
      const value = convert(amountInEUR);
      // Use browser locale or brand?.locale if you expose it
      const locale = (brand?.locale as string) || undefined;
      return new Intl.NumberFormat(locale, { style: "currency", currency, ...opts }).format(
        value
      );
    };
  }, [brand?.locale, currency, convert]);

  return { currency, setCurrency, convert, symbol, format };
}

export default useCurrency;
