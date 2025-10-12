"use client";

import { useEffect, useState, useCallback } from "react";

const LANG_KEY = "entiz_lang";
const CURRENCY_KEY = "entiz_currency";

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
  return m ? decodeURIComponent(m.pop() as string) : null;
}
function writeCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
}

export function getInitialLang() {
  if (typeof window === "undefined") return "en";
  return localStorage.getItem(LANG_KEY) || readCookie(LANG_KEY) || "en";
}
export function getInitialCurrency() {
  if (typeof window === "undefined") return "USD";
  return (
    localStorage.getItem(CURRENCY_KEY) || readCookie(CURRENCY_KEY) || "USD"
  );
}

export function usePrefs() {
  const [lang, setLangState] = useState<string>(getInitialLang);
  const [currency, setCurrencyState] = useState<string>(getInitialCurrency);

  const setLang = useCallback((code: string) => {
    setLangState(code);
    if (typeof window !== "undefined") {
      localStorage.setItem(LANG_KEY, code);
      writeCookie(LANG_KEY, code);
      window.dispatchEvent(new Event("entiz:prefs-changed"));
    }
  }, []);

  const setCurrency = useCallback((code: string) => {
    setCurrencyState(code);
    if (typeof window !== "undefined") {
      localStorage.setItem(CURRENCY_KEY, code);
      writeCookie(CURRENCY_KEY, code);
      window.dispatchEvent(new Event("entiz:prefs-changed"));
    }
  }, []);

  useEffect(() => {
    const onChange = () => {
      setLangState(getInitialLang());
      setCurrencyState(getInitialCurrency());
    };
    window.addEventListener("entiz:prefs-changed", onChange);
    return () => window.removeEventListener("entiz:prefs-changed", onChange);
  }, []);

  return { lang, currency, setLang, setCurrency };
}
