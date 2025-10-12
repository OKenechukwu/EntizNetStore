"use client";

import { useMemo } from "react";
import { useBrand } from "@/components/BrandProvider";

export function useCurrencyFormatter() {
  const { currency, locale } = useBrand();

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

  const formatPrice = (amount: number) => fmt.format(amount);

  return { currency, locale, formatPrice };
}
