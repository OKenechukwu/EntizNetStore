// components/i18n/I18nProvider.tsx
'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import englishDictionary from '@/locales/en.json';

type Dict = Record<string, any>;

type I18nContextType = {
  locale: string;
  currency: string;
  setLocale: (l: string) => void;
  setCurrency: (c: string) => void;
  t: (k: string, fallback?: string) => string;
  dict: Dict;
  fx?: Record<string, number>;
};

const I18nContext = createContext<I18nContextType | null>(null);
const ENGLISH_DICTIONARY = englishDictionary as Dict;

/* -------------------- helpers -------------------- */
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return;
  const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[2]) : undefined;
}

function getSupportedLocales(): string[] {
  const raw =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SUPPORTED_LOCALES) ||
    'en';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Optional default FX table (can be overridden if you fetch live rates) */
const DEFAULT_FX: Record<string, number> = {
  USD: 1,
  EUR: 0.93,
  GBP: 0.8,
  JPY: 156,
  CNY: 7.1,
  PHP: 58,
};

function mergeDictionary(base: Dict, override: Dict): Dict {
  const merged: Dict = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    const current = merged[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current &&
      typeof current === 'object' &&
      !Array.isArray(current)
    ) {
      merged[key] = mergeDictionary(current as Dict, value as Dict);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

/** SSR-safe locale loader. Every locale inherits the canonical English baseline. */
async function loadLocaleDict(locale: string): Promise<Dict> {
  if (locale === 'en') return ENGLISH_DICTIONARY;
  try {
    const mod = await import(`@/locales/${locale}.json`);
    const localized = ((mod as any).default ?? mod ?? {}) as Dict;
    return mergeDictionary(ENGLISH_DICTIONARY, localized);
  } catch {
    return ENGLISH_DICTIONARY;
  }
}

function resolveDictValue(dict: Dict, key: string): unknown {
  return key.split('.').reduce<unknown>((value, segment) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Dict)[segment];
  }, dict);
}

function humanizeKey(key: string) {
  const last = key.split('.').pop() || key;
  return last
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\.]/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/* -------------------- Provider -------------------- */
export default function I18nProvider({
  children,
  initialLocale,
  initialCurrency,
  initialFx,
}: {
  children: React.ReactNode;
  initialLocale?: string;
  initialCurrency?: string;
  initialFx?: Record<string, number>;
}) {
  const supported = useMemo(() => new Set(getSupportedLocales()), []);
  const [mounted, setMounted] = useState(false);

  const [locale, setLocaleState] = useState<string>(() => {
    const fromProp = (initialLocale || '').toLowerCase();
    const fromCookie = (getCookie('entiz_locale') || '').toLowerCase();
    const fromLS =
      (typeof window !== 'undefined' ? localStorage.getItem('entiz_locale') : '') || '';
    const picked =
      (fromProp && supported.has(fromProp) && fromProp) ||
      (fromCookie && supported.has(fromCookie) && fromCookie) ||
      (fromLS && supported.has(fromLS.toLowerCase()) && fromLS.toLowerCase()) ||
      'en';
    return picked;
  });

  const [currency, setCurrencyState] = useState<string>(() => {
    const fromProp = (initialCurrency || '').toUpperCase();
    const fromCookie = (getCookie('entiz_currency') || '').toUpperCase();
    const fromLS =
      (typeof window !== 'undefined' ? localStorage.getItem('entiz_currency') : '') || '';
    return (fromProp || fromCookie || fromLS || 'USD').toUpperCase();
  });

  // Never begin with an empty dictionary. The server/client first render gets
  // meaningful English copy until a requested locale has loaded.
  const [dict, setDict] = useState<Dict>(ENGLISH_DICTIONARY);
  const [fx, setFx] = useState<Record<string, number>>(initialFx || DEFAULT_FX);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const d = await loadLocaleDict(locale);
      if (!alive) return;
      setDict(d);
    })();
    return () => {
      alive = false;
    };
  }, [locale]);

  const setLocale = (l: string) => {
    const requested = l.trim().toLowerCase();
    const next = supported.has(requested) ? requested : 'en';
    setLocaleState(next);
    try {
      if (mounted) localStorage.setItem('entiz_locale', next);
      document.cookie = `entiz_locale=${encodeURIComponent(next)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    } catch {}
  };

  const setCurrency = (c: string) => {
    const next = c.toUpperCase();
    setCurrencyState(next);
    try {
      if (mounted) localStorage.setItem('entiz_currency', next);
      document.cookie = `entiz_currency=${encodeURIComponent(next)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    } catch {}
  };

  /**
   * Critical controls can provide a semantic fallback. This prevents loading or
   * missing-dictionary states from exposing humanized implementation keys such
   * as "Aria" or "Placeholder" to users and assistive technology.
   */
  const t = useMemo(() => {
    return (k: string, fallback?: string) => {
      const translated = resolveDictValue(dict, k);
      if (typeof translated === 'string' && translated.trim()) return translated;

      const english = resolveDictValue(ENGLISH_DICTIONARY, k);
      if (typeof english === 'string' && english.trim()) return english;

      if (fallback?.trim()) return fallback;
      return humanizeKey(k);
    };
  }, [dict]);

  const value = useMemo<I18nContextType>(
    () => ({ locale, currency, setLocale, setCurrency, t, dict, fx }),
    [locale, currency, t, dict, fx]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/* -------------------- Hooks & helpers -------------------- */
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>');
  return ctx;
}

/** Tiny text component: <T k="nav.signIn" fallback="Sign in" vars={{ count: 3 }} /> */
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
  let txt = t(k, fallback);
  if (vars) {
    for (const [key, val] of Object.entries(vars)) {
      txt = txt.split(`{${key}}`).join(String(val));
    }
  }
  return <>{txt}</>;
}
