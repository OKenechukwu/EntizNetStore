// components/layout/Header.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, Bell, Download, Menu, X } from "lucide-react";
import { T, useI18n } from "@/components/i18n/I18nProvider";
import LanguageCurrencySwitcher from "@/components/i18n/LanguageCurrencySwitcher";
import ProfileIconClient from "./ProfileIconClient";
import SearchSuggestions from "@/components/layout/SearchSuggestions";
import GlobalSearch from "@/components/search/GlobalSearch";

/**
 * Auth presence detector...
 */
function useAuthPresence() {
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasNextAuthCookie =
      /(?:^|;\s*)(?:__Secure-next-auth\.session-token|next-auth\.session-token)=/.test(
        document.cookie,
      );
    const hasSupabaseCookie = /(?:^|;\s*)(sb-[^=]+)=/.test(document.cookie);
    const hasSupabaseLS =
      Object.keys(localStorage || {}).some(
        (k) => /^sb-.+-auth-token$/.test(k) || k === "supabase.auth.token",
      ) && !!Object.values(localStorage || {}).length;

    setIsAuthed(
      Boolean(hasNextAuthCookie || hasSupabaseCookie || hasSupabaseLS),
    );
  }, []);

  return isAuthed;
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  useI18n();
  const router = useRouter();
  const isAuthed = useAuthPresence();

  const goProfile = () => {
    router.push(isAuthed ? "/account" : "/auth/sign-in");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/80 backdrop-blur-md">
      <div className="w-full px-4 py-3 md:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex min-w-0 shrink items-center gap-2 font-extrabold text-foreground sm:shrink-0"
            aria-label="EntizNetStore Home"
          >
            <span className="truncate text-xl font-extrabold md:text-2xl">
              EntizNet
              <span className="text-brand-secondary">
                <T k="common.store" fallback="Store" />
              </span>
            </span>
          </Link>

          {/* TopBar Links (wide desktop) */}
          <nav className="hidden items-center gap-1 xl:flex">
            <Link href="/stores" className="px-2 py-1.5 text-sm font-medium text-foreground/90 transition hover:text-brand-secondary 2xl:px-3"><T k="nav.stores" fallback="Stores" /></Link>
            <Link href="/brands" className="px-2 py-1.5 text-sm font-medium text-foreground/90 transition hover:text-brand-secondary 2xl:px-3"><T k="nav.brands" fallback="Brands" /></Link>
            <Link href="/live" className="px-2 py-1.5 text-sm font-medium text-foreground/90 transition hover:text-brand-secondary 2xl:px-3"><T k="nav.live" fallback="Live" /></Link>
            <Link href="/on-sale" className="px-2 py-1.5 text-sm font-medium text-foreground/90 transition hover:text-brand-secondary 2xl:px-3"><T k="nav.onSale" fallback="On Sale" /></Link>
            <Link href="/learn" className="px-2 py-1.5 text-sm font-medium text-foreground/90 transition hover:text-brand-secondary 2xl:px-3"><T k="nav.learn" fallback="Learn" /></Link>
          </nav>

          {/* Search (wide desktop) */}
          <div className="hidden min-w-0 flex-1 max-w-[420px] xl:flex 2xl:max-w-[520px]">
            <SearchSuggestions />
          </div>

          {/* Compact-screen Language/Currency switcher. Keep it out of the
              phone top row; it remains fully available inside the drawer. */}
          <div className="ml-auto hidden min-w-0 sm:block xl:hidden">
            <span suppressHydrationWarning>
              <LanguageCurrencySwitcher className="rounded-md bg-white/5 px-2 py-1" />
            </span>
          </div>

          {/* Compact navigation toggle */}
          <button
            type="button"
            className="ml-auto flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 text-foreground transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary sm:ml-0 xl:hidden"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>

          {/* Right controls (wide desktop) */}
          <div className="ml-auto hidden items-center gap-2 xl:flex">
            <span suppressHydrationWarning><LanguageCurrencySwitcher className="ml-2" /></span>
            <Link href="/apps" className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-brand-secondary/30 bg-brand-secondary/10 px-3 py-2 text-sm font-semibold text-brand-secondary transition hover:bg-brand-secondary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary" aria-label="Download EntizNetStore app">
              <Download className="h-4 w-4" aria-hidden="true" />
              <span className="hidden 2xl:inline">Download App</span>
            </Link>
            <Link href="/auth?mode=signin" className="inline-flex min-h-11 items-center rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary"><T k="nav.signIn" fallback="Sign in" /></Link>
            <button type="button" onClick={goProfile} aria-label="Profile" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-foreground/90 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary"><ProfileIconClient /></button>
            <Link href="/cart" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-foreground/90 transition hover:text-brand-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary" aria-label="Cart"><ShoppingCart className="h-5 w-5" aria-hidden="true" /></Link>
            <Link href="/notifications" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-foreground/90 transition hover:text-brand-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary" aria-label="Notifications"><Bell className="h-5 w-5" aria-hidden="true" /></Link>
          </div>
        </div>
      </div>

      {/* Nav Tabs (wide desktop) */}
      <div className="hidden w-full items-center justify-center gap-6 border-t border-white/10 bg-background/70 px-4 py-2.5 xl:flex">
        {[
          ["nav.home", "Home", "/"],
          ["nav.premium", "Premium", "/premium"],
          ["nav.luxury", "Luxury", "/luxury"],
          ["nav.collections", "Collections", "/collections"],
          ["nav.smartDevices", "Smart Devices", "/smart-devices"],
          ["nav.giftSets", "Gift Sets", "/gift-sets"],
        ].map(([key, fallback, href]) => (
          <Link key={href} href={href} className="rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10 hover:text-brand-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary">
            <T k={key} fallback={fallback} />
          </Link>
        ))}
      </div>

      {/* Compact menu */}
      {mobileOpen && (
        <div className="border-t border-white/10 bg-background/95 xl:hidden">
          <div className="space-y-4 px-4 py-4">
            <GlobalSearch />
            <div className="flex flex-col gap-2">
              {[
                { href: "/", key: "nav.home", fb: "Home" },
                { href: "/apps", key: "nav.downloadApp", fb: "Download App" },
                { href: "/premium", key: "nav.premium", fb: "Premium" },
                { href: "/luxury", key: "nav.luxury", fb: "Luxury" },
                { href: "/collections", key: "nav.collections", fb: "Collections" },
                { href: "/smart-devices", key: "nav.smartDevices", fb: "Smart Devices" },
                { href: "/gift-sets", key: "nav.giftSets", fb: "Gift Sets" },
                { href: "/stores", key: "nav.stores", fb: "Stores" },
                { href: "/brands", key: "nav.brands", fb: "Brands" },
                { href: "/live", key: "nav.live", fb: "Live" },
                { href: "/on-sale", key: "nav.onSale", fb: "On Sale" },
                { href: "/learn", key: "nav.learn", fb: "Learn" },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="flex min-h-11 items-center rounded-lg bg-white/5 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary" onClick={() => setMobileOpen(false)}>
                  <T k={link.key} fallback={link.fb} />
                </Link>
              ))}
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:gap-2">
              <span suppressHydrationWarning className="min-w-0"><LanguageCurrencySwitcher className="w-full sm:ml-2 sm:w-auto" /></span>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setMobileOpen(false); goProfile(); }} className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-brand-secondary px-4 py-2.5 text-center text-sm font-semibold text-background transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary"><T k="nav.profile" fallback="Profile" /></button>
                <Link href="/auth?mode=signin" className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-white/5 px-4 py-2.5 text-center text-sm font-semibold text-foreground transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary" onClick={() => setMobileOpen(false)}><T k="nav.signIn" fallback="Sign in" /></Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
