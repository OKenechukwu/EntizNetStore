// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

import Header from "@/components/layout/Header";
import { LayoutContent } from "./layout-content";
import SessionWatcher from "@/components/SessionWatcher";
import ClientBoot from "./ClientBoot";
import { BrandProvider } from "@/components/BrandProvider";
import { I18nProvider } from "@/components/i18n/I18nProvider";

import { cookies } from "next/headers";
import { DEFAULT_CURRENCY, SupportedCurrency } from "@/lib/currency";
import { SettingsProvider } from "@/providers/SettingsProvider";

export const metadata: Metadata = {
  title: "EntizNet Store - Luxury Adult Marketplace",
  description:
    "Premium adult products and experiences. Discreet, luxury, authentic.",
  keywords: "adult marketplace, luxury products, discreet shopping",
  robots: "noindex, nofollow",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read persisted preferences (SSR-safe)
  const c = cookies();
  const cookieLocale = c.get("locale")?.value || "en";
  const cookieCurrency =
    (c.get("currency")?.value as SupportedCurrency) || DEFAULT_CURRENCY;

  return (
    <html
      lang={cookieLocale}
      data-locale={cookieLocale}
      data-currency={cookieCurrency}
      data-theme="dark"
      suppressHydrationWarning
    >
      <body className="min-h-screen w-full bg-background text-foreground antialiased overflow-x-hidden">
        {/* Global settings (legacy consumers: money()/t()) */}
        <SettingsProvider
          initialLocale={cookieLocale}
          initialCurrency={cookieCurrency}
        >
          <BrandProvider>
            {/* New i18n context used by Language/Currency switcher + <Price/> */}
            <I18nProvider
              initialLocale={cookieLocale as any}
              initialCurrency={cookieCurrency as any}
            >
              <SessionWatcher />

              {/* Skip link for accessibility */}
              <a
                href="#main"
                className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-foreground focus:text-background focus:px-3 focus:py-2"
              >
                Skip to content
              </a>

              {/* Keep header exactly as-is visually */}
              <Header />

              <ClientBoot>
                <LayoutContent>
                  <main id="main" className="w-full">
                    {children}
                  </main>
                </LayoutContent>
              </ClientBoot>
            </I18nProvider>
          </BrandProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
