// components/CurrencyPicker.tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  SUPPORTED_CURRENCIES,
  DEFAULT_CURRENCY,
  toCurrencyCode,
} from "@/lib/currency";

function readCookie(name: string) {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export default function CurrencyPicker() {
  const router = useRouter();
  const [val, setVal] = useState(DEFAULT_CURRENCY);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setVal(toCurrencyCode(readCookie("currency")));
  }, []);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const currency = toCurrencyCode(e.target.value);
    setVal(currency);
    await fetch("/api/prefs/currency", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currency }),
    }).catch(() => {});
    // Re-render server components with the new cookie
    startTransition(() => router.refresh());
  }

  return (
    <select
      value={val}
      onChange={onChange}
      className="border rounded px-2 py-1 text-sm"
      disabled={isPending}
      aria-label="Select currency"
      title="Select currency"
    >
      {SUPPORTED_CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}
