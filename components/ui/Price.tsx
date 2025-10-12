// components/ui/Price.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrefs } from "@/hooks/usePrefs";

type Props = {
  amount: number; // e.g. 129.99
  className?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

export default function Price({
  amount,
  className = "",
  minimumFractionDigits = 2,
  maximumFractionDigits = 2,
}: Props) {
  const { currency } = usePrefs();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const formatter = useMemo(() => {
    const cur = (currency || "USD").toUpperCase();
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur,
      minimumFractionDigits,
      maximumFractionDigits,
    });
  }, [currency, minimumFractionDigits, maximumFractionDigits]);

  // Prevent SSR/CSR mismatch
  if (!mounted) {
    return <span className={className}> </span>;
  }
  return <span className={className}>{formatter.format(amount)}</span>;
}
