"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { formatMoney, type SupportedCurrency } from "@/lib/currency";
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
  money: (value: number | string) => string;
} | null>(null);

/** Legacy compatibility adapter over I18nProvider's single authoritative state. */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { locale, currency, setLocale, setCurrency, t, dict } = useI18n();
  const state = useMemo<SettingsState>(() => ({ locale, currency, dict }), [locale, currency, dict]);
  const value = useMemo(
    () => ({
      state,
      setLocale,
      setCurrency: (next: SupportedCurrency) => setCurrency(next),
      t: (key: string) => t(key),
      money: (amount: number | string) =>
        formatMoney(typeof amount === "string" ? Number.parseFloat(amount) || 0 : amount, currency, locale),
    }),
    [state, setLocale, setCurrency, t, currency, locale],
  );
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsCtx);
  if (!context) throw new Error("useSettings must be used within SettingsProvider");
  return context;
}
