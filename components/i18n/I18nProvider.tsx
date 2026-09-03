'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getDictionary,
  getEnglishDictionary,
  resolveDictionaryValue,
  type Dictionary,
} from '@/lib/i18n/dictionaries';
import {
  CURRENCY_CHANGE_EVENT,
  CURRENCY_COOKIE,
  CURRENCY_STORAGE_KEY,
  LEGACY_CURRENCY_KEYS,
  LEGACY_LOCALE_KEYS,
  LOCALE_CHANGE_EVENT,
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  getLocaleDirection,
  toLocale,
  type SupportedLocale,
} from '@/lib/preferences';
import {
  FALLBACK_RATES,
  coerceFxRates,
  getFxRates,
  toCurrencyCode,
  type CurrencyCode,
  type FxRates,
} from '@/lib/currency';

type I18nContextType = {
  locale: SupportedLocale;
  currency: CurrencyCode;
  setLocale: (value: string) => void;
  setCurrency: (value: string) => void;
  t: (key: string, fallback?: string) => string;
  dict: Dictionary;
  fx: FxRates;
  refreshFx: () => Promise<void>;
};

const I18nContext = createContext<I18nContextType | null>(null);
const ENGLISH_DICTIONARY = getEnglishDictionary();

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function getStoredValue(primary: string, legacy: readonly string[]) {
  if (typeof window === 'undefined') return undefined;
  try {
    const canonical = localStorage.getItem(primary);
    if (canonical) return canonical;
    for (const key of legacy) {
      const value = localStorage.getItem(key);
      if (value) return value;
    }
  } catch {}
  return undefined;
}

function clearLegacyPreference(keys: readonly string[]) {
  if (typeof document === 'undefined') return;
  for (const key of keys) {
    try {
      document.cookie = `${key}=; path=/; max-age=0; samesite=lax`;
      localStorage.removeItem(key);
    } catch {}
  }
}

function humanizeKey(key: string) {
  const last = key.split('.').pop() || key;
  return last
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\.]/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export default function I18nProvider({
  children,
  initialLocale,
  initialCurrency,
  initialFx,
}: {
  children: React.ReactNode;
  initialLocale?: string;
  initialCurrency?: string;
  initialFx?: Partial<Record<CurrencyCode, number>>;
}) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => toLocale(initialLocale));
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => toCurrencyCode(initialCurrency));
  const [dict, setDict] = useState<Dictionary>(() => getDictionary(initialLocale));
  const [fx, setFx] = useState<FxRates>(() => coerceFxRates(initialFx) || FALLBACK_RATES);

  useEffect(() => {
    setDict(getDictionary(locale));
    const root = document.documentElement;
    root.lang = locale;
    root.dir = getLocaleDirection(locale);
    root.dataset.locale = locale;
  }, [locale]);

  useEffect(() => {
    document.documentElement.dataset.currency = currency;
  }, [currency]);

  const setLocale = useCallback((value: string) => {
    const next = toLocale(value);
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
      document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      clearLegacyPreference(LEGACY_LOCALE_KEYS);
      window.dispatchEvent(new CustomEvent(LOCALE_CHANGE_EVENT, { detail: { locale: next } }));
    } catch {}
  }, []);

  const setCurrency = useCallback((value: string) => {
    const next = toCurrencyCode(value);
    setCurrencyState(next);
    try {
      localStorage.setItem(CURRENCY_STORAGE_KEY, next);
      document.cookie = `${CURRENCY_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      clearLegacyPreference(LEGACY_CURRENCY_KEYS);
      window.dispatchEvent(new CustomEvent(CURRENCY_CHANGE_EVENT, { detail: { currency: next } }));
    } catch {}
  }, []);

  useEffect(() => {
    const onLocale = (event: Event) => {
      const value = (event as CustomEvent<{ locale?: string }>).detail?.locale;
      if (value) setLocaleState(toLocale(value));
    };
    const onCurrency = (event: Event) => {
      const value = (event as CustomEvent<{ currency?: string }>).detail?.currency;
      if (value) setCurrencyState(toCurrencyCode(value));
    };
    window.addEventListener(LOCALE_CHANGE_EVENT, onLocale);
    window.addEventListener(CURRENCY_CHANGE_EVENT, onCurrency);
    return () => {
      window.removeEventListener(LOCALE_CHANGE_EVENT, onLocale);
      window.removeEventListener(CURRENCY_CHANGE_EVENT, onCurrency);
    };
  }, []);

  // Migrate localStorage-only legacy preferences after hydration without changing
  // the server-rendered first frame. Canonical localStorage always wins.
  useEffect(() => {
    try {
      if (!localStorage.getItem(LOCALE_STORAGE_KEY)) {
        const storedLocale = getStoredValue(LOCALE_STORAGE_KEY, LEGACY_LOCALE_KEYS);
        if (storedLocale) setLocale(storedLocale);
      }
      if (!localStorage.getItem(CURRENCY_STORAGE_KEY)) {
        const storedCurrency = getStoredValue(CURRENCY_STORAGE_KEY, LEGACY_CURRENCY_KEYS);
        if (storedCurrency) setCurrency(storedCurrency);
      }
    } catch {}
  }, [setCurrency, setLocale]);

  const refreshFx = useCallback(async () => {
    const rates = await getFxRates({ force: true });
    setFx(rates);
  }, []);

  useEffect(() => {
    let active = true;
    getFxRates().then((rates) => {
      if (active) setFx(rates);
    });
    return () => {
      active = false;
    };
  }, []);

  const t = useMemo(() => {
    return (key: string, fallback?: string) => {
      const translated = resolveDictionaryValue(dict, key);
      if (typeof translated === 'string' && translated.trim()) return translated;
      const english = resolveDictionaryValue(ENGLISH_DICTIONARY, key);
      if (typeof english === 'string' && english.trim()) return english;
      if (fallback?.trim()) return fallback;
      return humanizeKey(key);
    };
  }, [dict]);

  const value = useMemo<I18nContextType>(
    () => ({ locale, currency, setLocale, setCurrency, t, dict, fx, refreshFx }),
    [locale, currency, setLocale, setCurrency, t, dict, fx, refreshFx],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within <I18nProvider>');
  return context;
}

export function T({
  k,
  fallback,
  vars,
}: {
  k: string;
  fallback?: string;
  vars?: Record<string, string | number>;
}) {
  const { t } = useI18n();
  let text = t(k, fallback);
  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      text = text.split(`{${key}}`).join(String(value));
    }
  }
  return <>{text}</>;
}
