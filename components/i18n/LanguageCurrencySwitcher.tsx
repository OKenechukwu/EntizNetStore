"use client";

import { useId } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { SUPPORTED_LOCALES } from "@/lib/preferences";

type Props = {
  showLabels?: boolean;
  className?: string;
};

export default function LanguageCurrencySwitcher({ showLabels = false, className = "" }: Props) {
  const { currency, setCurrency, locale, setLocale, t } = useI18n();
  const instanceId = useId();
  const languageId = `${instanceId}-language`;
  const currencyId = `${instanceId}-currency`;
  const languageLabel = t("common.language", "Language");
  const currencyLabel = t("common.currency", "Currency");

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex min-w-0 items-center gap-1.5">
        <label htmlFor={languageId} className={showLabels ? "text-xs text-foreground/70" : "sr-only"}>
          {languageLabel}
        </label>
        <select
          id={languageId}
          value={locale}
          onChange={(event) => setLocale(event.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          aria-label={languageLabel}
        >
          {SUPPORTED_LOCALES.map((language) => (
            <option key={language.code} value={language.code}>
              {language.shortLabel}
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
          value={currency}
          onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          aria-label={currencyLabel}
        >
          {SUPPORTED_CURRENCIES.map((code) => (
            <option key={code} value={code}>{code}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
