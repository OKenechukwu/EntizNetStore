// hooks/usePrefs.ts
"use client";

import { useEffect, useState, useCallback } from "react";

type Prefs = {
  lang: string;
  currency: string;
  setLang: (v: string) => void;
  setCurrency: (v: string) => void;
};

const LANG_KEY = "entiz_lang";
const CUR_KEY = "entiz_currency";

export function usePrefs(): Prefs {
  const [mounted, setMounted] = useState(false);
  const [lang, setLangState] = useState<string>("en");
  const [currency, setCurrencyState] = useState<string>("USD");

  useEffect(() => {
    setMounted(true);
    try {
      const l = localStorage.getItem(LANG_KEY);
      const c = localStorage.getItem(CUR_KEY);
      if (l) setLangState(l);
      if (c) setCurrencyState(c.toUpperCase());
    } catch {}
  }, []);

  const setLang = useCallback((v: string) => {
    setLangState(v);
    try {
      localStorage.setItem(LANG_KEY, v);
      document.cookie = `lang=${encodeURIComponent(v)};path=/;max-age=31536000;SameSite=Lax`;
    } catch {}
  }, []);

  const setCurrency = useCallback((v: string) => {
    const up = v.toUpperCase();
    setCurrencyState(up);
    try {
      localStorage.setItem(CUR_KEY, up);
      document.cookie = `currency=${encodeURIComponent(up)};path=/;max-age=31536000;SameSite=Lax`;
    } catch {}
  }, []);

  if (!mounted) {
    // safe defaults until hydration completes (prevents mismatch)
    return { lang: "en", currency: "USD", setLang, setCurrency };
  }

  return { lang, currency, setLang, setCurrency };
}
