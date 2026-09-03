"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { BASE_CURRENCY, type CurrencyCode, type FxRates } from "@/lib/currency";

type BrandContextType = {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  baseCurrency: CurrencyCode;
  fx: FxRates;
  rates: FxRates;
  refreshFx: () => Promise<void>;
};

const BrandContext = createContext<BrandContextType | undefined>(undefined);

/**
 * Compatibility adapter for legacy callers. I18nProvider is the sole owner of
 * marketplace locale/currency/FX state; this provider must never create a second
 * preference state machine.
 */
export function BrandProvider({ children }: { children: React.ReactNode }) {
  const { currency, setCurrency, fx, refreshFx } = useI18n();
  const value = useMemo<BrandContextType>(
    () => ({
      currency,
      setCurrency: (next) => setCurrency(next),
      baseCurrency: BASE_CURRENCY,
      fx,
      rates: fx,
      refreshFx,
    }),
    [currency, fx, refreshFx, setCurrency],
  );
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): BrandContextType {
  const context = useContext(BrandContext);
  if (!context) throw new Error("useBrand must be used within <BrandProvider>");
  return context;
}
