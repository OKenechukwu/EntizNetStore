"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, DollarSign, ChevronDown } from "lucide-react";
import { usePrefs } from "@/hooks/usePrefs";

// Fallback lists (use your own lists if you have them)
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
];

const CURRENCIES = [
  { code: "USD", label: "USD $" },
  { code: "EUR", label: "EUR €" },
  { code: "GBP", label: "GBP £" },
  { code: "JPY", label: "JPY ¥" },
  { code: "CNY", label: "CNY ¥" },
  { code: "PHP", label: "PHP ₱" },
];

export default function LanguageCurrencyMenu({
  className = "",
}: {
  className?: string;
}) {
  const { lang, currency, setLang, setCurrency } = usePrefs();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const currentLang =
    LANGUAGES.find((l) => l.code === lang)?.label ||
    lang?.toUpperCase() ||
    "EN";
  const currentCur = (currency || "USD").toUpperCase();

  return (
    <div className={`relative ${className}`} ref={panelRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-foreground hover:bg-white/10"
      >
        <Globe className="h-4 w-4 opacity-80" />
        <span className="hidden sm:inline">{currentLang}</span>
        <span className="opacity-60">/</span>
        <DollarSign className="h-4 w-4 opacity-80" />
        <span className="hidden sm:inline">{currentCur}</span>
        <ChevronDown className="ml-1 h-4 w-4 opacity-70" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-[320px] rounded-xl border border-white/10 bg-background/95 p-3 shadow-xl backdrop-blur"
        >
          {/* Language */}
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Globe className="h-4 w-4 opacity-80" />
              <span>Language</span>
            </div>
            <label className="block">
              <span className="sr-only">Select language</span>
              <select
                aria-label="Language"
                className="w-full rounded-md border border-white/15 bg-white/5 px-2 py-2 text-sm outline-none hover:bg-white/10"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Currency */}
          <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <DollarSign className="h-4 w-4 opacity-80" />
              <span>Currency</span>
            </div>
            <label className="block">
              <span className="sr-only">Select currency</span>
              <select
                aria-label="Currency"
                className="w-full rounded-md border border-white/15 bg-white/5 px-2 py-2 text-sm outline-none hover:bg-white/10"
                value={currency?.toUpperCase() || "USD"}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
