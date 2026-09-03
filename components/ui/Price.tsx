"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import {
  convertFromBase,
  formatPrice,
  toCurrencyCode,
  type CurrencyCode,
} from "@/lib/currency";

type Props = {
  amountUSD?: number | string | null;
  amount?: number | string | null;
  rates?: Partial<Record<CurrencyCode, number>>;
  className?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

function toNumberUSD(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value).trim().replace(/[^0-9.,-]/g, "").replace(/,/g, ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function Price({
  amountUSD,
  amount,
  rates,
  className,
  minimumFractionDigits,
  maximumFractionDigits,
}: Props) {
  const { locale } = useI18n();
  const { currency, rates: canonicalRates } = useCurrency();
  const code = toCurrencyCode(currency);
  const base = toNumberUSD(amountUSD ?? amount);
  const effectiveRates = rates || canonicalRates;
  const converted = useMemo(
    () => convertFromBase(base, code, effectiveRates),
    [base, code, effectiveRates],
  );

  const formatted = useMemo(() => {
    if (minimumFractionDigits === undefined && maximumFractionDigits === undefined) {
      return formatPrice(converted, code, locale);
    }
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: code,
        minimumFractionDigits,
        maximumFractionDigits,
      }).format(converted);
    } catch {
      return formatPrice(converted, code, locale);
    }
  }, [converted, code, locale, minimumFractionDigits, maximumFractionDigits]);

  return <span className={className}>{formatted}</span>;
}
