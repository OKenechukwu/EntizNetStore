// components/i18n/I18nProvider.tsx
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getDict, Locale } from "@/lib/i18n/dictionaries";

type Currency = "USD" | "EUR" | "GBP" | "JPY" | "CNY" | "PHP";

type Ctx = {
  locale: Locale;
  currency: Currency;
  dict: Record<string, any>;
  setLocale: (l: Locale) => void;
  setCurrency: (c: Currency) => void;
  t: (k: string, fallback?: string) => string;
};

const Ctx = createContext<Ctx | null>(null);

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}
function writeCookie(k: string, v: string) {
  document.cookie = `${k}=${encodeURIComponent(v)}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

export function I18nProvider({
  initialLocale = "en",
  initialCurrency = "USD",
  children,
}: {
  initialLocale?: Locale;
  initialCurrency?: Currency;
  children: React.ReactNode;
}) {
  // Seed from SSR hints in <html data-*> if present
  const ssrLocale =
    (typeof document !== "undefined" &&
      (document.documentElement.getAttribute(
        "data-locale",
      ) as Locale | null)) ||
    null;
  const ssrCurrency =
    (typeof document !== "undefined" &&
      (document.documentElement.getAttribute(
        "data-currency",
      ) as Currency | null)) ||
    null;

  const [locale, setLocale] = useState<Locale>(ssrLocale || initialLocale);
  const [currency, setCurrency] = useState<Currency>(
    ssrCurrency || initialCurrency,
  );
  const [dict, setDict] = useState(getDict(locale));

  // One-time sync from cookies/localStorage (prevents hydration mismatch)
  useEffect(() => {
    const cLoc =
      (readCookie("entiz_locale") as Locale | null) ||
      (localStorage.getItem("entiz_locale") as Locale | null);
    const cCur =
      (readCookie("entiz_currency") as Currency | null) ||
      (localStorage.getItem("entiz_currency") as Currency | null);
    if (cLoc && cLoc !== locale) {
      setLocale(cLoc);
      setDict(getDict(cLoc));
    }
    if (cCur && cCur !== currency) setCurrency(cCur);
    // ensure defaults exist
    if (!cLoc) writeCookie("entiz_locale", locale);
    if (!cCur) writeCookie("entiz_currency", currency);
  }, []);

  useEffect(() => {
    setDict(getDict(locale));
  }, [locale]);

  const t = useMemo(
    () =>
      (k: string, fallback = k) => {
        const parts = k.split(".");
        let cur: any = dict;
        for (const p of parts) cur = cur?.[p];
        return (typeof cur === "string" && cur) || fallback;
      },
    [dict],
  );

  const value: Ctx = { locale, currency, dict, setLocale, setCurrency, t };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("I18nProvider missing");
  return v;
}

export function T({ k, fallback }: { k: string; fallback?: string }) {
  const { t } = useI18n();
  return <>{t(k, fallback)}</>;
}

// Helpers to persist from UI
export function persistLocale(l: Locale) {
  localStorage.setItem("entiz_locale", l);
  writeCookie("entiz_locale", l);
}
export function persistCurrency(c: Currency) {
  localStorage.setItem("entiz_currency", c);
  writeCookie("entiz_currency", c);
}
