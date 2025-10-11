// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

import Header from "@/components/layout/Header";
import { LayoutContent } from "./layout-content";
import SessionWatcher from "@/components/SessionWatcher";
import ClientBoot from "./ClientBoot";
import { BrandProvider } from "@/components/BrandProvider";

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
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className="min-h-screen w-full bg-background text-foreground antialiased overflow-x-hidden">
        <BrandProvider>
          {/* Global session/auth watcher */}
          <SessionWatcher />

          {/* Skip link for accessibility */}
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-foreground focus:text-background focus:px-3 focus:py-2"
          >
            Skip to content
          </a>

          {/* ✅ Moved Header inside BrandProvider */}
          <Header />

          {/* Ensure client boot + app chrome are within BrandProvider */}
          <ClientBoot>
            <LayoutContent>
              <main id="main" className="w-full">{children}</main>
            </LayoutContent>
          </ClientBoot>
        </BrandProvider>
      </body>
    </html>
  );
}
