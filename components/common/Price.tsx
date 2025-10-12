"use client";

import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";

type PriceProps = {
  /** Amount in base units (e.g., 129.99). If you store cents, set cents=true. */
  amount: number;
  /** If your DB stores cents (e.g., 12999), pass cents to divide by 100. */
  cents?: boolean;
  className?: string;
};

export default function Price({ amount, cents = false, className = "" }: PriceProps) {
  const { formatPrice } = useCurrencyFormatter();
  const value = cents ? amount / 100 : amount;
  return <span className={className}>{formatPrice(value)}</span>;
}
