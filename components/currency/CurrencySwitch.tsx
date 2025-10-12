"use client";

import { usePrefs } from "@/hooks/usePrefs";

// If you already have a supported currency list, import it:
// import { SUPPORTED_CURRENCIES } from '@/lib/currency';

// Fallback minimal list:
const FALLBACK_CURRENCIES = [
  { code: "USD", label: "USD $" },
  { code: "EUR", label: "EUR €" },
  { code: "GBP", label: "GBP £" },
  { code: "JPY", label: "JPY ¥" },
  { code: "CNY", label: "CNY ¥" },
  { code: "PHP", label: "PHP ₱" },
];

export default function CurrencySwitch({
  className = "",
}: {
  className?: string;
}) {
  const { currency, setCurrency } = usePrefs();

  const CURS = FALLBACK_CURRENCIES; // or SUPPORTED_CURRENCIES if present

  return (
    <label className={`inline-flex items-center gap-2 text-sm ${className}`}>
      <span className="sr-only">Currency</span>
      <select
        aria-label="Currency"
        className="rounded-md border border-white/20 bg-white/5 px-2 py-1 outline-none hover:bg-white/10"
        value={currency}
        onChange={(e) => setCurrency(e.target.value.toUpperCase())}
      >
        {CURS.map((c) => (
          <option key={c.code} value={c.code}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}
