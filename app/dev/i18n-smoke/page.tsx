'use client';
import { T, useI18n } from '@/components/i18n/I18nProvider';

export default function I18nSmoke() {
  const { locale } = useI18n();
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">i18n Smoke Test</h1>
      <p className="opacity-80 mb-4">Current locale: {locale}</p>

      <h3 className="font-extrabold mb-2"><T k="welcome" /></h3>
      <p><T k="categories" /></p>
      <p><T k="brands" /></p>
      <p><T k="popular" /></p>
    </main>
  );
}
