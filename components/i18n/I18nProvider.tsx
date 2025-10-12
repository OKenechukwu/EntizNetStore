"use client";

import { createContext, useContext, useMemo } from "react";
import type { I18nContextValue } from "@/lib/i18n/types";
import { usePrefs } from "@/hooks/usePrefs";
import { MESSAGES, getMessage } from "@/lib/i18n/registry";

const I18nCtx = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { lang: userLang } = usePrefs(); // expects values like "en", "de", "fr"
  const lang = MESSAGES[userLang] ? userLang : "en";
  const bag = MESSAGES[lang];

  const value = useMemo<I18nContextValue>(() => {
    const t = (key: string, vars?: Record<string, string | number>) => {
      const raw = getMessage(bag, key) ?? key; // fall back to key if missing
      if (!vars) return String(raw);
      return String(raw).replace(/\{(\w+)\}/g, (_, k) =>
        String(vars[k] ?? `{${k}}`),
      );
    };
    return { lang, t };
  }, [lang, bag]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}

/** Convenience component: <T k="home.bestSellingProducts" /> */
export function T({
  k,
  vars,
}: {
  k: string;
  vars?: Record<string, string | number>;
}) {
  const { t } = useI18n();
  return <>{t(k, vars)}</>;
}
