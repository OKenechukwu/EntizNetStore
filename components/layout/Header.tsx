// components/layout/Header.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingCart, Bell, Search, Menu, X } from "lucide-react";
import { T, useI18n } from "@/components/i18n/I18nProvider";
import LanguageCurrencySwitcher from "@/components/i18n/LanguageCurrencySwitcher";
import ProfileIconClient from "./ProfileIconClient";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/80 backdrop-blur-md">
      {/* TopBar - Logo, Links, Search, Language, Icons */}
      <div className="w-full px-4 py-3 md:px-8">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 font-extrabold text-foreground shrink-0"
            aria-label="EntizNetStore Home"
          >
            <span className="text-xl md:text-2xl font-extrabold">
              EntizNet
              <span className="text-brand-secondary">Store</span>
            </span>
          </Link>

          {/* TopBar Links - Desktop Only */}
          <nav className="hidden lg:flex items-center gap-1">
            <Link
              href="/stores"
              className="px-3 py-1.5 text-sm font-medium text-foreground/90 transition hover:text-brand-secondary"
            >
              <T k="nav.stores" />
            </Link>
            <Link
              href="/brands"
              className="px-3 py-1.5 text-sm font-medium text-foreground/90 transition hover:text-brand-secondary"
            >
              <T k="nav.brands" />
            </Link>
            <Link
              href="/live"
              className="px-3 py-1.5 text-sm font-medium text-foreground/90 transition hover:text-brand-secondary"
            >
              <T k="nav.live" />
            </Link>
            <Link
              href="/on-sale"
              className="px-3 py-1.5 text-sm font-medium text-foreground/90 transition hover:text-brand-secondary"
            >
              <T k="nav.onSale" />
            </Link>
            <Link
              href="/learn"
              className="px-3 py-1.5 text-sm font-medium text-foreground/90 transition hover:text-brand-secondary"
            >
              <T k="nav.learn" />
            </Link>
          </nav>

          {/* Search Bar - Compact */}
          <div className="hidden md:flex flex-1 max-w-[520px] lg:max-w-[520px]">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
              <input
                type="search"
                placeholder={t("search.placeholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-foreground/50 focus:border-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-secondary/20"
                aria-label={t("search.aria")}
              />
            </div>
          </div>

          {/* Right: Language + Icons */}
          <div className="hidden md:flex items-center gap-2 ml-auto">
            <LanguageCurrencySwitcher className="ml-2" />

            <Link
              href="/auth?mode=signin"
              className="rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10"
            >
              <T k="nav.signIn" />
            </Link>

            <ProfileIconClient />

            <Link
              href="/cart"
              className="rounded-lg p-2 text-foreground/90 transition hover:text-brand-secondary"
              aria-label="Cart"
            >
              <ShoppingCart className="h-5 w-5" />
            </Link>

            <Link
              href="/notifications"
              className="rounded-lg p-2 text-foreground/90 transition hover:text-brand-secondary"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="ml-auto rounded-lg p-2 text-foreground md:hidden"
            aria-label="Toggle menu"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* MainNav - Category Tabs */}
      <div className="hidden md:flex w-full items-center justify-center gap-6 border-t border-white/10 bg-background/70 px-4 py-2.5">
        <Link
          href="/"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10 hover:text-brand-secondary"
        >
          <T k="nav.home" />
        </Link>
        <Link
          href="/premium"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10 hover:text-brand-secondary"
        >
          <T k="nav.premium" />
        </Link>
        <Link
          href="/luxury"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition hover:text-brand-secondary"
        >
          <T k="nav.luxury" />
        </Link>
        <Link
          href="/collections"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10 hover:text-brand-secondary"
        >
          <T k="nav.collections" />
        </Link>
        <Link
          href="/smart-devices"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10 hover:text-brand-secondary"
        >
          <T k="nav.smartDevices" />
        </Link>
        <Link
          href="/gift-sets"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10 hover:text-brand-secondary"
        >
          <T k="nav.giftSets" />
        </Link>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 bg-background/95">
          <div className="px-4 py-4 space-y-4">
            {/* Mobile Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
              <input
                type="search"
                placeholder={t("search.placeholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-foreground/50 focus:border-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-secondary/20"
                aria-label={t("search.aria")}
              />
            </div>

            {/* Mobile Navigation */}
            <div className="flex flex-col gap-2">
              {[
                { href: "/", labelKey: "nav.home" },
                { href: "/premium", labelKey: "nav.premium" },
                { href: "/luxury", labelKey: "nav.luxury" },
                { href: "/collections", labelKey: "nav.collections" },
                { href: "/smart-devices", labelKey: "nav.smartDevices" },
                { href: "/gift-sets", labelKey: "nav.giftSets" },
                { href: "/stores", labelKey: "nav.stores" },
                { href: "/brands", labelKey: "nav.brands" },
                { href: "/live", labelKey: "nav.live" },
                { href: "/on-sale", labelKey: "nav.onSale" },
                { href: "/learn", labelKey: "nav.learn" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg bg-white/5 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-white/10"
                  onClick={() => setMobileOpen(false)}
                >
                  <T k={link.labelKey} />
                </Link>
              ))}
            </div>

            {/* Mobile Actions */}
            <div className="flex items-center gap-2 pt-2">
              <LanguageCurrencySwitcher className="ml-2" />
              <Link
                href="/auth?mode=signin"
                className="flex-1 rounded-lg bg-brand-secondary px-4 py-2.5 text-center text-sm font-semibold text-background transition hover:opacity-90"
                onClick={() => setMobileOpen(false)}
              >
                <T k="nav.signIn" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
