"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Globe, DollarSign } from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "th", label: "ไทย" },
  { code: "ja", label: "日本語" },
  { code: "fil", label: "Filipino" },
];

const CURRENCIES = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen" },
  { code: "THB", symbol: "฿", label: "Thai Baht" },
  { code: "PHP", symbol: "₱", label: "Philippine Peso" },
];

export default function LanguageCurrencyMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [language, setLanguage] = useState("en");
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    const savedLang = localStorage.getItem("preferred_language");
    const savedCurrency = localStorage.getItem("preferred_currency");
    if (savedLang) setLanguage(savedLang);
    if (savedCurrency) setCurrency(savedCurrency);
  }, []);

  const handleLanguageChange = (code: string) => {
    setLanguage(code);
    localStorage.setItem("preferred_language", code);
  };

  const handleCurrencyChange = (code: string) => {
    setCurrency(code);
    localStorage.setItem("preferred_currency", code);
  };

  const currentLang = LANGUAGES.find((l) => l.code === language);
  const currentCurrency = CURRENCIES.find((c) => c.code === currency);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm font-medium text-foreground transition hover:bg-white/10"
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{currentLang?.label}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-white/10 bg-card shadow-lg">
            {/* Languages Section */}
            <div className="p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground/60">
                <Globe className="h-3 w-3" />
                Language
              </div>
              <div className="space-y-1">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      handleLanguageChange(lang.code);
                      setIsOpen(false);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      language === lang.code
                        ? "bg-brand-secondary/20 text-brand-secondary"
                        : "text-foreground hover:bg-white/5"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-border" />

            {/* Currencies Section */}
            <div className="p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground/60">
                <DollarSign className="h-3 w-3" />
                Currency
              </div>
              <div className="space-y-1">
                {CURRENCIES.map((curr) => (
                  <button
                    key={curr.code}
                    onClick={() => {
                      handleCurrencyChange(curr.code);
                      setIsOpen(false);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      currency === curr.code
                        ? "bg-brand-secondary/20 text-brand-secondary"
                        : "text-foreground hover:bg-white/5"
                    }`}
                  >
                    <span className="font-medium">{curr.symbol}</span>{" "}
                    {curr.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
