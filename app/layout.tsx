// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

import Header from "@/components/layout/Header";
import { LayoutContent } from "./layout-content";
import SessionWatcher from "@/components/SessionWatcher";
import { BrandProvider } from "@/components/providers/BrandProvider";
import I18nProvider from "@/components/i18n/I18nProvider";

import { cookies } from "next/headers";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/currency";
import { publicIndexingAllowed } from "@/lib/launch/publicIndexing";
import { SettingsProvider } from "@/providers/SettingsProvider";

const siteIndexingEnabled = publicIndexingAllowed();

export const metadata: Metadata = {
  title: "EntizNet Store - Luxury Adult Marketplace",
  description:
    "Premium adult products and experiences. Discreet, luxury, authentic.",
  keywords: "adult marketplace, luxury products, discreet shopping",
  robots: siteIndexingEnabled
    ? {
        index: true,
        follow: true,
      }
    : {
        index: false,
        follow: false,
        noarchive: true,
        googleBot: {
          index: false,
          follow: false,
          noarchive: true,
        },
      },
};

function readSupportedLocales(): string[] {
  const raw = process.env.NEXT_PUBLIC_SUPPORTED_LOCALES || "en";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
function clampLocale(candidate: string | undefined, supported: string[]): string {
  const lc = (candidate || "en").split("-")[0].toLowerCase();
  return supported.includes(lc) ? lc : "en";
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const c = await cookies();

  const cookieLocaleRaw =
    c.get("entiz_locale")?.value ||
    c.get("locale")?.value ||
    "en";

  const cookieCurrencyRaw =
    (c.get("entiz_currency")?.value as CurrencyCode) ||
    (c.get("currency")?.value as CurrencyCode) ||
    DEFAULT_CURRENCY;

  const supported = readSupportedLocales();
  const initialLocale = clampLocale(cookieLocaleRaw, supported);
  const initialCurrency = (cookieCurrencyRaw || DEFAULT_CURRENCY) as CurrencyCode;

  return (
    <html
      lang={initialLocale}
      data-locale={initialLocale}
      data-currency={initialCurrency}
      data-theme="dark"
      suppressHydrationWarning
    >
      <body className="min-h-screen w-full bg-background text-foreground antialiased overflow-x-hidden">
        <SettingsProvider initialLocale={initialLocale} initialCurrency={initialCurrency}>
          <BrandProvider>
            <I18nProvider initialLocale={initialLocale} initialCurrency={initialCurrency}>
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
            </I18nProvider>
          </BrandProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
