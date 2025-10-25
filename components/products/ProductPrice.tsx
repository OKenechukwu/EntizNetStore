// ---------- components/product/ProductPrice.tsx ----------
"use client";

import { useCurrency } from "@/lib/useCurrency";

export default function ProductPrice({
  basePriceEUR,
}: {
  basePriceEUR: number;
}) {
  const { format } = useCurrency();
  return <span className="text-2xl font-bold">{format(basePriceEUR)}</span>;
}
