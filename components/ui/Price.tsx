// components/ui/Price.tsx
"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";

type Props = {
  amount: number | string;
  className?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

export default function Price({
  amount,
  className = "",
  minimumFractionDigits,
  maximumFractionDigits,
}: Props) {
  const { locale, currency } = useI18n();

  // Avoid SSR/CSR mismatch in header/cart totals, etc.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className={className} />;

  const numeric =
    typeof amount === "string"
      ? Number(amount)
      : Number.isFinite(amount)
        ? (amount as number)
        : 0;

  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    ...(minimumFractionDigits !== undefined ? { minimumFractionDigits } : {}),
    ...(maximumFractionDigits !== undefined ? { maximumFractionDigits } : {}),
  });

  return (
    <span className={className}>
      {formatter.format(Number.isFinite(numeric) ? numeric : 0)}
    </span>
  );
}
