'use client';

import { useI18n } from '@/components/i18n/I18nProvider';

export function useCurrency() {
  const { currency, fx } = useI18n() as any;
  // If you maintain a rate table in I18nProvider (fx), convert here; otherwise treat as already-converted.
  const convert = (usd: number) => (fx?.[currency] ? usd * fx[currency] : usd);
  const format = (amountUSD: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(convert(amountUSD));
  return { currency, format };
}
