'use client';

import { useEffect, useState, type ElementType } from 'react';
import { useI18n } from './I18nProvider';
import { translate } from '@/lib/i18n/translate';

type TagName = ElementType;

export default function I18nText({
  text,
  as: Tag = 'span',
  className,
}: {
  text: string;
  as?: TagName;
  className?: string;
}) {
  const { locale } = useI18n();
  const [out, setOut] = useState<string>(text);

  useEffect(() => {
    let alive = true;
    try {
      const key = `i18n:${locale}:${text}`;
      const cached = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      if (cached) {
        setOut(cached);
        return;
      }
    } catch {}

    (async () => {
      try {
        if (!locale || locale === 'en') {
          setOut(text);
          return;
        }
        const res = await translate(text, locale, { sourceLang: 'en' });
        if (alive) {
          setOut(res);
          try { localStorage.setItem(`i18n:${locale}:${text}`, res); } catch {}
        }
      } catch {
        if (alive) setOut(text);
      }
    })();

    return () => {
      alive = false;
    };
  }, [text, locale]);

  return <Tag className={className}>{out}</Tag>;
}
