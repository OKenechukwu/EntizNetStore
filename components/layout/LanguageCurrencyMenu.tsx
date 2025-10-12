// components/layout/LanguageCurrencyMenu.tsx
"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Globe, DollarSign, ChevronDown } from "lucide-react";
import { usePrefs } from "@/hooks/usePrefs";

// Lists (keep or replace with your own)
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

  // Hydration guard (prevents “Server: USD / Client: EUR”)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Compact header label
  const langShort = useMemo(
    () => ((mounted ? lang : "en") || "en").slice(0, 2).toUpperCase(),
    [lang, mounted],
  );
  const curShort = useMemo(
    () => ((mounted ? currency : "USD") || "USD").toUpperCase(),
    [currency, mounted],
  );

  // Close panel on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className={`relative ${className}`} ref={panelRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-white/10"
      >
        <Globe className="h-3.5 w-3.5 opacity-80" />
        {mounted ? (
          <span>{langShort}</span>
        ) : (
          <span className="invisible">EN</span>
        )}
        <span className="opacity-60">/</span>
        <DollarSign className="h-3.5 w-3.5 opacity-80" />
        {mounted ? (
          <span>{curShort}</span>
        ) : (
          <span className="invisible">USD</span>
        )}
        <ChevronDown className="ml-0.5 h-3.5 w-3.5 opacity-70" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-[300px] rounded-xl border border-white/10 bg-background/95 p-3 shadow-xl backdrop-blur"
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
                className="w-full rounded-md border border-white/15 bg-white text-black px-2 py-2 text-sm outline-none"
                value={mounted ? lang : "en"}
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
                className="w-full rounded-md border border-white/15 bg-white text-black px-2 py-2 text-sm outline-none"
                value={mounted ? currency?.toUpperCase() || "USD" : "USD"}
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
