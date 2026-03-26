// components/i18n/I18nProvider.tsx
'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Dict = Record<string, any>;

type I18nContextType = {
  locale: string;
  currency: string;
  setLocale: (l: string) => void;
  setCurrency: (c: string) => void;
  t: (k: string) => string;
  dict: Dict;
  fx?: Record<string, number>;
};

const I18nContext = createContext<I18nContextType | null>(null);

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

/** ✅ Simpler & SSR-safe locale loader: JSON only, fallback to en */
async function loadLocaleDict(locale: string): Promise<Dict> {
  try {
    const mod = await import(`@/locales/${locale}.json`);
    return (mod as any).default ?? mod ?? {};
  } catch {
    try {
      const en = await import(`@/locales/en.json`);
      return (en as any).default ?? en ?? {};
    } catch {
      return {};
    }
  }
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

  const [dict, setDict] = useState<Dict>({});
  const [fx, setFx] = useState<Record<string, number>>(initialFx || DEFAULT_FX);

  useEffect(() => setMounted(true), []);

  // Load dictionary when locale changes
  useEffect(() => {
    let alive = true;
    (async () => {
      const d = await loadLocaleDict(locale);
      if (!alive) return;
      setDict(d || {});
    })();
    return () => {
      alive = false;
    };
  }, [locale]);

  const setLocale = (l: string) => {
    const next = l.toLowerCase();
    setLocaleState(next);
    try {
      if (mounted) localStorage.setItem('entiz_locale', next);
      document.cookie = `entiz_locale=${encodeURIComponent(next)}; path=/; max-age=${60 * 60 * 24 * 365}`;
    } catch {}
  };

  const setCurrency = (c: string) => {
    const next = c.toUpperCase();
    setCurrencyState(next);
    try {
      if (mounted) localStorage.setItem('entiz_currency', next);
      document.cookie = `entiz_currency=${encodeURIComponent(next)}; path=/; max-age=${60 * 60 * 24 * 365}`;
    } catch {}
  };

  /** Humanized fallback so raw keys never show */
  const t = useMemo(() => {
    return (k: string) => {
      const v = k.split('.').reduce<any>((o, p) => (o ? o[p] : undefined), dict);
      if (typeof v === 'string') return v;
      const last = k.split('.').pop() || k;
      return last.replace(/[_\.]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
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

/** Tiny text component: <T k="nav.signIn" fallback="Sign in" /> */
export function T({ k, fallback }: { k: string; fallback?: string }) {
  const { t } = useI18n();
  const txt = t(k);
  return <>{txt || fallback || ''}</>;
}
