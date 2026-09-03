import type { Metadata } from "next";
import "./globals.css";

import Header from "@/components/layout/Header";
import { LayoutContent } from "./layout-content";
import SessionWatcher from "@/components/SessionWatcher";
import { BrandProvider } from "@/components/providers/BrandProvider";
import I18nProvider from "@/components/i18n/I18nProvider";
import { SettingsProvider } from "@/providers/SettingsProvider";
import { cookies } from "next/headers";
import { DEFAULT_CURRENCY, toCurrencyCode } from "@/lib/currency";
import { publicIndexingAllowed } from "@/lib/launch/publicIndexing";
import {
  CURRENCY_COOKIE,
  LEGACY_CURRENCY_KEYS,
  LEGACY_LOCALE_KEYS,
  LOCALE_COOKIE,
  getLocaleDirection,
  toLocale,
} from "@/lib/preferences";

const siteIndexingEnabled = publicIndexingAllowed();

export const metadata: Metadata = {
  title: "EntizNet Store - Luxury Adult Marketplace",
  description: "Premium adult products and experiences. Discreet, luxury, authentic.",
  keywords: "adult marketplace, luxury products, discreet shopping",
  robots: siteIndexingEnabled
    ? { index: true, follow: true }
    : {
        index: false,
        follow: false,
        noarchive: true,
        googleBot: { index: false, follow: false, noarchive: true },
      },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const localeCandidate =
    cookieStore.get(LOCALE_COOKIE)?.value ||
    LEGACY_LOCALE_KEYS.map((key) => cookieStore.get(key)?.value).find(Boolean);
  const currencyCandidate =
    cookieStore.get(CURRENCY_COOKIE)?.value ||
    LEGACY_CURRENCY_KEYS.map((key) => cookieStore.get(key)?.value).find(Boolean) ||
    DEFAULT_CURRENCY;

  const initialLocale = toLocale(localeCandidate);
  const initialCurrency = toCurrencyCode(currencyCandidate);

  return (
    <html
      lang={initialLocale}
      dir={getLocaleDirection(initialLocale)}
      data-locale={initialLocale}
      data-currency={initialCurrency}
      data-theme="dark"
      suppressHydrationWarning
    >
      <body className="min-h-screen w-full bg-background text-foreground antialiased overflow-x-hidden">
        <I18nProvider initialLocale={initialLocale} initialCurrency={initialCurrency}>
          <SettingsProvider>
            <BrandProvider>
              <SessionWatcher />
              <a
                href="#main"
                className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-foreground focus:text-background focus:px-3 focus:py-2"
              >
                Skip to content
              </a>
              <Header />
              <LayoutContent>
                <main id="main" tabIndex={-1} className="w-full">
                  {children}
                </main>
              </LayoutContent>
            </BrandProvider>
          </SettingsProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
