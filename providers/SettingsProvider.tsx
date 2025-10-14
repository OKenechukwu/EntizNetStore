"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cookiesGet } from "@/utils/cookies";
import {
  formatMoney,
  DEFAULT_CURRENCY,
  SupportedCurrency,
} from "@/lib/currency";

// Dictionaries
import { dict as en } from "@/i18n/dictionaries/en";
import { dict as zh } from "@/i18n/dictionaries/zh";
import { dict as ja } from "@/i18n/dictionaries/ja";
import { dict as vi } from "@/i18n/dictionaries/vi";
import { dict as th } from "@/i18n/dictionaries/th";

type Dict = Record<string, string>;
const DICTS: Record<string, Dict> = { en, zh, ja, vi, th };

export type SettingsState = {
  locale: string;
  currency: SupportedCurrency;
  dict: Dict;
};

const DEFAULT_LOCALE = "en";

const SettingsCtx = createContext<{
  state: SettingsState;
  setLocale: (l: string) => void;
  setCurrency: (c: SupportedCurrency) => void;
  t: (key: string) => string;
  money: (n: number | string) => string;
} | null>(null);

export function SettingsProvider({
  children,
  initialLocale,
  initialCurrency,
}: {
  children: React.ReactNode;
  initialLocale?: string;
  initialCurrency?: SupportedCurrency;
}) {
  const [state, setState] = useState<SettingsState>(() => {
    const cookieLocale =
      initialLocale || cookiesGet("locale") || DEFAULT_LOCALE;
    const cookieCurrency =
      initialCurrency ||
      (cookiesGet("currency") as SupportedCurrency) ||
      DEFAULT_CURRENCY;
    const dict = DICTS[cookieLocale] || en;
    return { locale: cookieLocale, currency: cookieCurrency, dict };
  });

  // Client re-hydration from localStorage
  useEffect(() => {
    const lsLocale = localStorage.getItem("locale") || state.locale;
    const lsCurrency =
      (localStorage.getItem("currency") as SupportedCurrency) || state.currency;
    setState((s) => ({
      locale: lsLocale,
      currency: lsCurrency,
      dict: DICTS[lsLocale] || en,
    }));

    const onCurrency = () => {
      const c =
        (localStorage.getItem("currency") as SupportedCurrency) ||
        DEFAULT_CURRENCY;
      setState((s) => ({ ...s, currency: c }));
    };
    window.addEventListener("currencyChange", onCurrency);
    return () => window.removeEventListener("currencyChange", onCurrency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = (l: string) => {
    document.cookie = `locale=${l}; path=/; max-age=31536000`;
    localStorage.setItem("locale", l);
    setState((s) => ({ ...s, locale: l, dict: DICTS[l] || en }));
  };

  const setCurrency = (c: SupportedCurrency) => {
    document.cookie = `currency=${c}; path=/; max-age=31536000`;
    localStorage.setItem("currency", c);
    setState((s) => ({ ...s, currency: c }));
    window.dispatchEvent(new Event("currencyChange"));
  };

  const t = (key: string) => state.dict[key] ?? key;
  const money = (n: number | string) =>
    formatMoney(n, state.currency, state.locale);

  const value = useMemo(
    () => ({ state, setLocale, setCurrency, t, money }),
    [state],
  );

  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
