// components/providers/BrandProvider.tsx
"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  getActiveCurrency,
  setActiveCurrency,
  getFxRates,
  saveFxRates,
  type CurrencyCode,
  type FxRates,
  DEFAULT_CURRENCY,
  BASE_CURRENCY,
} from "@/lib/currency";

type BrandContextType = {
  // existing brand fields can stay here (theme, colors, etc.)
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  baseCurrency: CurrencyCode;
  fx: FxRates | null;
  refreshFx: () => Promise<void>;
};

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [fx, setFx] = useState<FxRates | null>(null);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      const active = getActiveCurrency();
      setCurrencyState(active);
      const rates = await getFxRates();
      setFx(rates);
    };
    init();
  }, []);

  const setCurrency = (c: CurrencyCode) => {
    setActiveCurrency(c);
    setCurrencyState(c);
  };

  const refreshFx = async () => {
    // In Phase 1, we just re-read from storage/fallback.
    // In Phase 1B, you can fetch from /api/fx and then saveFxRates().
    const rates = await getFxRates();
    setFx(rates);
    // If you wire a real fetch, call saveFxRates(newRates) afterward.
    saveFxRates(rates);
  };

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
      baseCurrency: BASE_CURRENCY,
      fx,
      refreshFx,
    }),
    [currency, fx]
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): BrandContextType {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error("useBrand must be used within <BrandProvider>");
  return ctx;
}
