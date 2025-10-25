// components/i18n/LanguageCurrencySwitcher.tsx
"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

/** Persist helpers */
function setCookie(k: string, v: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${k}=${encodeURIComponent(v)}; path=/; max-age=${
    60 * 60 * 24 * 365
  }`;
}
function getSupportedLocales(): string[] {
  const raw =
    (typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_SUPPORTED_LOCALES) ||
    "en";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Languages (code + native) — full list but we’ll filter by env */
const ALL_LANGS: { code: string; native: string }[] = [
  { code: "en", native: "English" },
  { code: "de", native: "Deutsch" },
  { code: "fr", native: "Français" },
  { code: "es", native: "Español" },
  { code: "it", native: "Italiano" },
  { code: "ja", native: "日本語" },
  { code: "ko", native: "한국어" },
  { code: "zh", native: "中文" },
  { code: "ru", native: "Русский" },
  { code: "ar", native: "العربية" },
  { code: "pt", native: "Português" },
  { code: "vi", native: "Tiếng Việt" },
  { code: "th", native: "ไทย" },
  { code: "uk", native: "Українська" },
  { code: "pl", native: "Polski" },
  { code: "hi", native: "हिन्दी" },
  { code: "id", native: "Bahasa Indonesia" },
  { code: "tr", native: "Türkçe" },
  { code: "nl", native: "Nederlands" },
  { code: "sv", native: "Svenska" },
  { code: "fi", native: "Suomi" },
];

/** Currencies (keep small; you can expand later) */
const CURRENCIES = [
  { code: "USD", label: "USD" },
  { code: "EUR", label: "EUR" },
  { code: "GBP", label: "GBP" },
  { code: "JPY", label: "JPY" },
  { code: "CNY", label: "CNY" },
  { code: "PHP", label: "PHP" },
];

export default function LanguageCurrencySwitcher({
  className,
}: {
  className?: string;
}) {
  // Your I18nProvider should expose locale/currency + setters
  const { locale, currency, setLocale, setCurrency } = useI18n() as any;
  const router = useRouter();

  // Hydration guard
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Only show locales you actually support (from env)
  const SUPPORTED = useMemo(() => {
    const allow = new Set(getSupportedLocales());
    return ALL_LANGS.filter((l) => allow.has(l.code));
  }, []);

  const onLocale = (code: string) => {
    const lc = code.split("-")[0].toLowerCase();
    setLocale?.(lc);
    setCookie("entiz_locale", lc);
    try {
      localStorage.setItem("entiz_locale", lc);
    } catch {}
    router.refresh(); // let SSR pick it up for hydration stability
  };

  const onCurrency = (code: string) => {
    setCurrency?.(code);
    setCookie("entiz_currency", code);
    try {
      localStorage.setItem("entiz_currency", code);
    } catch {}
    router.refresh();
  };

  return (
    <div className={`flex items-center gap-2 ${className || ""}`}>
      {/* Language */}
      <div className="relative">
        <details className="group">
          <summary className="cursor-pointer select-none rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm uppercase shadow-sm hover:bg-white/10">
            <span suppressHydrationWarning>
              {mounted ? locale?.toUpperCase() || "EN" : ""}
            </span>
          </summary>

          {/* Panel with low-opacity glassy background */}
          <div
            className="
              absolute right-0 z-50 mt-2 w-[22rem]
              rounded-xl border border-white/10
              bg-black/60 backdrop-blur-md
              shadow-xl ring-1 ring-black/20
              p-2
              max-h-[70vh] overflow-auto
            "
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
              {SUPPORTED.map((l) => (
                <button
                  key={l.code}
                  onClick={() => onLocale(l.code)}
                  className={`
                    flex w-full items-center gap-2 rounded-lg
                    px-3 py-2 text-left text-sm
                    hover:bg-white/10 transition
                    ${l.code === locale ? "font-semibold bg-white/10" : ""}
                  `}
                >
                  <span className="inline-block rounded-md bg-white/10 px-2 py-0.5 text-xs uppercase">
                    {l.code}
                  </span>
                  <span className="truncate">{l.native}</span>
                </button>
              ))}
            </div>
          </div>
        </details>
      </div>

      {/* Currency */}
      <div className="relative">
        <details className="group">
          <summary className="cursor-pointer select-none rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm uppercase shadow-sm hover:bg-white/10">
            <span suppressHydrationWarning>
              {mounted ? currency || "USD" : ""}
            </span>
          </summary>

          <div
            className="
              absolute right-0 z-50 mt-2 w-40
              rounded-xl border border-white/10
              bg-black/60 backdrop-blur-md
              shadow-xl ring-1 ring-black/20
              p-2
            "
          >
            <div className="flex flex-col gap-1">
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => onCurrency(c.code)}
                  className={`
                    w-full rounded-lg px-3 py-2 text-left text-sm
                    hover:bg-white/10 transition
                    ${c.code === currency ? "font-semibold bg-white/10" : ""}
                  `}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
