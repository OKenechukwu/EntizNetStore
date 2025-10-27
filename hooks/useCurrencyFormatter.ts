"use client";

import { useMemo } from "react";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { convertFromBase } from "@/lib/currency";

export function useCurrencyFormatter() {
  const { currency, rates } = useCurrency();
  const { locale } = useI18n();

  const fmt = useMemo(() => {
    try {
      return new Intl.NumberFormat(locale || "en", {
        style: "currency",
        currency: (currency || "USD").toUpperCase(),
        maximumFractionDigits: 2,
      });
    } catch {
      return new Intl.NumberFormat("en", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      });
    }
  }, [currency, locale]);

  const formatPrice = (amountInBase: number) => {
    // Convert from BASE_CURRENCY (USD) to target currency using current rates
    const converted = convertFromBase(amountInBase, currency, rates);
    return fmt.format(converted);
  };

  return { currency, locale, formatPrice };
}
