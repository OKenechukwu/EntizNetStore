// components/currency/CurrencyProvider.tsx
// Compatibility shim that forwards currency state to the new BrandProvider.

"use client";

import React, { PropsWithChildren, createContext } from "react";
import { useBrand } from "@/components/providers/BrandProvider";
import type { CurrencyCode, FxRates } from "@/lib/currency";

export type CurrencyContextValue = {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  fx: FxRates | null;
  refreshFx: () => Promise<void>;
};

// Export a context only for legacy imports; it's not used for state anymore.
export const CurrencyContext = createContext<CurrencyContextValue | null>(null);

// No-op wrapper so existing trees that include <CurrencyProvider> keep working.
export function CurrencyProvider({ children }: PropsWithChildren) {
  return <>{children}</>;
}

// Legacy hook reimplemented to read from BrandProvider.
export function useCurrency(): CurrencyContextValue {
  const { currency, setCurrency, fx, refreshFx } = useBrand();
  return { currency, setCurrency, fx, refreshFx };
}

export default CurrencyProvider;
