// components/i18n/LanguageCurrencySwitcher.tsx
"use client";

import { useEffect, useId, useState } from "react";
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
  const { locale, setLocale, t } = useI18n();
  const [localCurrency, setLocalCurrency] = useState<CurrencyCode>(currency);
  const [localLang, setLocalLang] = useState<string>(locale || "en");
  const instanceId = useId();
  const languageId = `${instanceId}-language`;
  const currencyId = `${instanceId}-currency`;
  const languageLabel = t("common.language", "Language");
  const currencyLabel = t("common.currency", "Currency");

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
      <div className="flex min-w-0 items-center gap-1.5">
        <label htmlFor={languageId} className={showLabels ? "text-xs text-foreground/70" : "sr-only"}>
          {languageLabel}
        </label>
        <select
          id={languageId}
          value={localLang}
          onChange={onChangeLanguage}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          aria-label={languageLabel}
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-w-0 items-center gap-1.5">
        <label htmlFor={currencyId} className={showLabels ? "text-xs text-foreground/70" : "sr-only"}>
          {currencyLabel}
        </label>
        <select
          id={currencyId}
          value={localCurrency}
          onChange={onChangeCurrency}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          aria-label={currencyLabel}
        >
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
