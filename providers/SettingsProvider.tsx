"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  convertAndFormatFromBase,
  type SupportedCurrency,
} from "@/lib/currency";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { SupportedLocale } from "@/lib/preferences";

export type SettingsState = {
  locale: SupportedLocale;
  currency: SupportedCurrency;
  dict: Dictionary;
};

const SettingsCtx = createContext<{
  state: SettingsState;
  setLocale: (locale: string) => void;
  setCurrency: (currency: SupportedCurrency) => void;
  t: (key: string) => string;
  money: (amountInUsd: number | string) => string;
} | null>(null);

// Compatibility adapter only. It deliberately owns no preference state.
export function SettingsProvider({ children }: { children: React.ReactNode; initialLocale?: string; initialCurrency?: SupportedCurrency }) {
  const { locale, currency, dict, setLocale, setCurrency, t, fx } = useI18n();
  const state = useMemo<SettingsState>(() => ({ locale, currency, dict }), [locale, currency, dict]);
  const value = useMemo(
    () => ({
      state,
      setLocale,
      setCurrency: (next: SupportedCurrency) => setCurrency(next),
      t: (key: string) => t(key),
      money: (amountInUsd: number | string) => {
        const parsed = typeof amountInUsd === "string" ? Number.parseFloat(amountInUsd) : amountInUsd;
        const amount = Number.isFinite(parsed) ? parsed : 0;
        return convertAndFormatFromBase(amount, { currency, rates: fx, locale });
      },
    }),
    [state, setLocale, setCurrency, t, currency, fx, locale],
  );
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsCtx);
  if (!context) throw new Error("useSettings must be used within SettingsProvider");
  return context;
}
