// components/i18n/LanguageCurrencySwitcher.tsx
"use client";
import {
  useI18n,
  persistLocale,
  persistCurrency,
} from "@/components/i18n/I18nProvider";
import { useRouter } from "next/navigation";

export default function LanguageCurrencySwitcher(props: {
  className?: string;
}) {
  const { locale, currency, setLocale, setCurrency } = useI18n();
  const router = useRouter();

  const onLocale = (l: any) => {
    setLocale(l);
    persistLocale(l);
    router.refresh(); // re-seed server components if any
  };
  const onCurrency = (c: any) => {
    setCurrency(c);
    persistCurrency(c);
    router.refresh();
  };

  // ⬇️ Keep your existing JSX—just bind onChange to these handlers
  return (
    <div className={props.className}>
      {/* Example only—replace with your current controls */}
      {/* <select value={locale} onChange={(e)=>onLocale(e.target.value)}>...</select>
      <select value={currency} onChange={(e)=>onCurrency(e.target.value)}>...</select> */}
    </div>
  );
}
