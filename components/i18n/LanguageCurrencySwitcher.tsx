// components/i18n/LanguageCurrencySwitcher.tsx
"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

/** Persist helpers */
function setCookie(k: string, v: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${k}=${encodeURIComponent(v)}; path=/; max-age=${60 * 60 * 24 * 365}`;
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

/** Languages (code + native) */
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

/** Currencies */
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
  const { locale, setLocale } = useI18n();
  const { currency, setCurrency } = useCurrency();
  const router = useRouter();

  // Hydration guard
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Only show locales you actually support
  const SUPPORTED = useMemo(() => {
    const allow = new Set(getSupportedLocales());
    return ALL_LANGS.filter((l) => allow.has(l.code));
  }, []);

  /** Refs for <details> to programmatically close */
  const langRef = useRef<HTMLDetailsElement>(null);
  const currRef = useRef<HTMLDetailsElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const closeAll = () => {
    if (langRef.current?.open) langRef.current.open = false;
    if (currRef.current?.open) currRef.current.open = false;
  };

  // Close on outside click and on Escape
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) closeAll();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Ensure only one panel is open at a time
  const onLangToggle = () => {
    if (langRef.current?.open && currRef.current?.open) currRef.current.open = false;
  };
  const onCurrToggle = () => {
    if (currRef.current?.open && langRef.current?.open) langRef.current.open = false;
  };

  const onLocalePick = (code: string) => {
    // ONLY update locale - do NOT touch currency
    setLocale(code as any);
    setCookie("entiz_locale", code);
    try { localStorage.setItem("entiz_locale", code); } catch {}
    closeAll();
    router.refresh();
  };

  const onCurrencyPick = (code: string) => {
    // ONLY update currency - do NOT touch locale  
    setCurrency(code as any);
    // CurrencyProvider handles cookie/localStorage persistence internally
    closeAll();
    router.refresh();
  };

  return (
    <div ref={wrapperRef} className={`flex items-center gap-2 ${className || ""}`}>
      {/* Language */}
      <div className="relative">
        <details ref={langRef} className="group" onToggle={onLangToggle}>
          <summary
            className="cursor-pointer select-none rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm uppercase shadow-sm hover:bg-white/10"
            aria-haspopup="menu"
            aria-expanded={langRef.current?.open || false}
          >
            <span suppressHydrationWarning>
              {mounted ? locale?.toUpperCase() || "EN" : ""}
            </span>
          </summary>

          {/* Panel with low-opacity background + blur */}
          <div
            className="
              absolute right-0 z-50 mt-2 w-[22rem]
              rounded-xl border border-white/10
              bg-black/60 backdrop-blur-md
              shadow-xl ring-1 ring-black/20
              p-2
              max-h-[70vh] overflow-auto
            "
            role="menu"
          >
            {/* Two columns on md+, one column on small screens */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
              {SUPPORTED.map((l) => (
                <button
                  key={l.code}
                  onClick={() => onLocalePick(l.code)}
                  className={`
                    flex w-full items-center gap-2 rounded-lg
                    px-3 py-2 text-left text-sm
                    hover:bg-white/10 transition
                    ${l.code === locale ? "font-semibold bg-white/10" : ""}
                  `}
                  role="menuitem"
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
        <details ref={currRef} className="group" onToggle={onCurrToggle}>
          <summary
            className="cursor-pointer select-none rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm uppercase shadow-sm hover:bg-white/10"
            aria-haspopup="menu"
            aria-expanded={currRef.current?.open || false}
          >
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
            role="menu"
          >
            <div className="flex flex-col gap-1">
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => onCurrencyPick(c.code)}
                  className={`
                    w-full rounded-lg px-3 py-2 text-left text-sm
                    hover:bg-white/10 transition
                    ${c.code === currency ? "font-semibold bg-white/10" : ""}
                  `}
                  role="menuitem"
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
