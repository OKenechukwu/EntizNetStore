// components/i18n/LanguageCurrencySwitcher.tsx
"use client";

import { useEffect, useState } from "react";
import { useBrand } from "@/components/providers/BrandProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/lib/currency";

const SUPPORTED_LANGUAGES = [
  { code: "en", label: "EN", fullLabel: "English" },
  { code: "es", label: "ES", fullLabel: "Español" },
  { code: "fr", label: "FR", fullLabel: "Français" },
  { code: "de", label: "DE", fullLabel: "Deutsch" },
  { code: "pt", label: "PT", fullLabel: "Português" },
  { code: "ja", label: "JA", fullLabel: "日本語" },
  { code: "zh", label: "ZH", fullLabel: "中文" },
  { code: "th", label: "TH", fullLabel: "ไทย" },
  { code: "ar", label: "AR", fullLabel: "العربية" },
  { code: "id", label: "ID", fullLabel: "Indonesia" },
  { code: "ru", label: "RU", fullLabel: "Русский" },
  { code: "hi", label: "HI", fullLabel: "हिन्दी" },
];

type Props = {
  showLabels?: boolean;
  className?: string;
};

export default function LanguageCurrencySwitcher({ showLabels = false, className = "" }: Props) {
  const { currency, setCurrency } = useBrand();
  const { locale, setLocale } = useI18n();
  const [localCurrency, setLocalCurrency] = useState<CurrencyCode>(currency);
  const [localLang, setLocalLang] = useState<string>(locale || "en");

  useEffect(() => {
    setLocalCurrency(currency);
  }, [currency]);

  useEffect(() => {
    setLocalLang(locale || "en");
  }, [locale]);

  const onChangeCurrency = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as CurrencyCode;
    setLocalCurrency(next);
    setCurrency(next);
  };

  const onChangeLanguage = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    setLocalLang(next);
    setLocale(next);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <select
        id="language-select"
        value={localLang}
        onChange={onChangeLanguage}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        aria-label="Language"
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>

      <select
        id="currency-select"
        value={localCurrency}
        onChange={onChangeCurrency}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        aria-label="Currency"
      >
        {SUPPORTED_CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}
