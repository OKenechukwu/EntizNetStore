"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSettings } from "@/providers/SettingsProvider";
import { SUPPORTED_CURRENCIES, CURRENCY_NAMES } from "@/lib/currency";
import { useBrand } from "@/components/BrandProvider";

export default function LanguageCurrencySwitcher() {
  const { theme } = useBrand();
  const { state, setLocale, setCurrency } = useSettings();
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const currentCurrencyInfo = CURRENCY_NAMES[state.currency] || {
    name: state.currency,
    symbol: state.currency,
  };

  const LANGUAGES = [
    { code: "en", name: "English", native: "English" },
    { code: "zh", name: "Chinese", native: "中文" },
    { code: "ja", name: "Japanese", native: "日本語" },
    { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
    { code: "th", name: "Thai", native: "ไทย" },
  ];

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:opacity-80 transition-all"
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.glass.border,
          color: theme.colors.text.primary,
        }}
        aria-label="Language and Currency Settings"
      >
        <div className="flex items-center gap-1 text-sm">
          <span>🌐</span>
          <span className="hidden sm:inline">{state.locale.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <span>{currentCurrencyInfo.symbol}</span>
          <span className="hidden sm:inline">{state.currency}</span>
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div
          className="absolute right-0 mt-2 w-80 rounded-lg border shadow-lg z-50"
          style={{
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.glass.border,
          }}
        >
          <div className="p-4">
            {/* Languages Section */}
            <div className="mb-6">
              <h3
                className="text-sm font-semibold mb-3"
                style={{ color: theme.colors.text.primary }}
              >
                🌐 Language
              </h3>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLocale(lang.code);
                      router.refresh();
                      setIsDropdownOpen(false);
                    }}
                    className={`text-left px-3 py-2 text-xs rounded hover:opacity-80 transition-all ${
                      state.locale === lang.code ? "font-semibold" : ""
                    }`}
                    style={{
                      backgroundColor:
                        state.locale === lang.code
                          ? theme.colors.accent + "20"
                          : theme.colors.surface,
                      color:
                        state.locale === lang.code
                          ? theme.colors.accent
                          : theme.colors.text.primary,
                    }}
                  >
                    <div className="truncate">{lang.native}</div>
                    <div className="text-xs opacity-70 truncate">
                      {lang.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Currencies Section */}
            <div>
              <h3
                className="text-sm font-semibold mb-3"
                style={{ color: theme.colors.text.primary }}
              >
                💱 Currency
              </h3>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {SUPPORTED_CURRENCIES.map((curr) => {
                  const info = CURRENCY_NAMES[curr] || {
                    name: curr,
                    symbol: curr,
                  };
                  return (
                    <button
                      key={curr}
                      onClick={() => {
                        setCurrency(curr as any);
                        setIsDropdownOpen(false);
                      }}
                      className={`text-left px-3 py-2 text-xs rounded hover:opacity-80 transition-all ${
                        state.currency === curr ? "font-semibold" : ""
                      }`}
                      style={{
                        backgroundColor:
                          state.currency === curr
                            ? theme.colors.accent + "20"
                            : theme.colors.surface,
                        color:
                          state.currency === curr
                            ? theme.colors.accent
                            : theme.colors.text.primary,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>{info.symbol}</span>
                        <span className="truncate">{curr}</span>
                      </div>
                      <div className="text-xs opacity-70 truncate">
                        {info.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Close Button */}
            <div
              className="mt-4 pt-3 border-t"
              style={{ borderColor: theme.colors.glass.border }}
            >
              <button
                onClick={() => setIsDropdownOpen(false)}
                className="w-full py-2 text-sm rounded transition-all hover:opacity-80"
                style={{
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text.secondary,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isDropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </div>
  );
}
