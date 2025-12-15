// components/i18n/LanguageCurrencySwitcher.tsx
"use client";

import { useEffect, useState } from "react";
import { useBrand } from "@/components/providers/BrandProvider";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/lib/currency";

type Props = {
  // If you already pass language bits, keep them here (optional)
  showLabels?: boolean;
  className?: string;
};

export default function LanguageCurrencySwitcher({ showLabels = false, className = "" }: Props) {
  const { currency, setCurrency } = useBrand();
  const [localCurrency, setLocalCurrency] = useState<CurrencyCode>(currency);

  useEffect(() => {
    setLocalCurrency(currency);
  }, [currency]);

  const onChangeCurrency = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as CurrencyCode;
    setLocalCurrency(next);
    setCurrency(next); // updates cookie + context
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Language selector can sit here if you have it; leaving as-is to not break your i18n flow */}
      {/* <LanguageSelect ... /> */}

      {/* Currency */}
      <label className="text-xs text-foreground/70" htmlFor="currency-select">
        {showLabels ? "Currency" : null}
      </label>
      <select
        id="currency-select"
        value={localCurrency}
        onChange={onChangeCurrency}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
      >
        {SUPPORTED_CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}
