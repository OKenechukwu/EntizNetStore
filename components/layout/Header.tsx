// components/layout/Header.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, Bell, Menu, X } from "lucide-react";
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
  const { t } = useI18n();
  const router = useRouter();
  const isAuthed = useAuthPresence();

  const goProfile = () => {
    router.push(isAuthed ? "/account" : "/auth/sign-in");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/80 backdrop-blur-md">
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
              <span className="text-brand-secondary">
                <T k="common.store" fallback="Store" />
              </span>
            </span>
          </Link>

          {/* TopBar Links */}
          <nav className="hidden lg:flex items-center gap-1">
            <Link
              href="/stores"
              className="px-3 py-1.5 text-sm font-medium text-foreground/90 transition hover:text-brand-secondary"
            >
              <T k="nav.stores" fallback="Stores" />
            </Link>
            <Link
              href="/brands"
              className="px-3 py-1.5 text-sm font-medium text-foreground/90 transition hover:text-brand-secondary"
            >
              <T k="nav.brands" fallback="Brands" />
            </Link>
            <Link
              href="/live"
              className="px-3 py-1.5 text-sm font-medium text-foreground/90 transition hover:text-brand-secondary"
            >
              <T k="nav.live" fallback="Live" />
            </Link>
            <Link
              href="/on-sale"
              className="px-3 py-1.5 text-sm font-medium text-foreground/90 transition hover:text-brand-secondary"
            >
              <T k="nav.onSale" fallback="On Sale" />
            </Link>
            <Link
              href="/learn"
              className="px-3 py-1.5 text-sm font-medium text-foreground/90 transition hover:text-brand-secondary"
            >
              <T k="nav.learn" fallback="Learn" />
            </Link>
          </nav>

          {/* Search */}
          <div className="hidden md:flex flex-1 max-w-[520px] lg:max-w-[520px]">
            <SearchSuggestions />
          </div>

          {/* Right Icons */}
          <div className="hidden md:flex items-center gap-2 ml-auto">
            <span suppressHydrationWarning>
              <LanguageCurrencySwitcher className="ml-2" />
            </span>

            <Link
              href="/auth?mode=signin"
              className="rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10"
            >
              <T k="nav.signIn" fallback="Sign in" />
            </Link>

            {/* ✅ FIXED: Profile icon wrapped in <div> instead of <button> */}
            <div
              onClick={goProfile}
              role="button"
              aria-label="Profile"
              className="cursor-pointer rounded-lg p-2 text-foreground/90 transition hover:bg-white/10"
            >
              <ProfileIconClient />
            </div>

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

          {/* Mobile Toggle */}
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

      {/* Nav Tabs */}
      <div className="hidden md:flex w-full items-center justify-center gap-6 border-t border-white/10 bg-background/70 px-4 py-2.5">
        {[
          ["nav.home", "Home", "/"],
          ["nav.premium", "Premium", "/premium"],
          ["nav.luxury", "Luxury", "/luxury"],
          ["nav.collections", "Collections", "/collections"],
          ["nav.smartDevices", "Smart Devices", "/smart-devices"],
          ["nav.giftSets", "Gift Sets", "/gift-sets"],
        ].map(([key, fallback, href]) => (
          <Link
            key={href}
            href={href}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10 hover:text-brand-secondary"
          >
            <T k={key} fallback={fallback} />
          </Link>
        ))}
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 bg-background/95">
          <div className="px-4 py-4 space-y-4">
            <GlobalSearch />

            <div className="flex flex-col gap-2">
              {[
                { href: "/", key: "nav.home", fb: "Home" },
                { href: "/premium", key: "nav.premium", fb: "Premium" },
                { href: "/luxury", key: "nav.luxury", fb: "Luxury" },
                {
                  href: "/collections",
                  key: "nav.collections",
                  fb: "Collections",
                },
                {
                  href: "/smart-devices",
                  key: "nav.smartDevices",
                  fb: "Smart Devices",
                },
                { href: "/gift-sets", key: "nav.giftSets", fb: "Gift Sets" },
                { href: "/stores", key: "nav.stores", fb: "Stores" },
                { href: "/brands", key: "nav.brands", fb: "Brands" },
                { href: "/live", key: "nav.live", fb: "Live" },
                { href: "/on-sale", key: "nav.onSale", fb: "On Sale" },
                { href: "/learn", key: "nav.learn", fb: "Learn" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg bg-white/5 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-white/10"
                  onClick={() => setMobileOpen(false)}
                >
                  <T k={link.key} fallback={link.fb} />
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <span suppressHydrationWarning>
                <LanguageCurrencySwitcher className="ml-2" />
              </span>

              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  goProfile();
                }}
                className="flex-1 rounded-lg bg-brand-secondary px-4 py-2.5 text-center text-sm font-semibold text-background transition hover:opacity-90"
              >
                <T k="nav.profile" fallback="Profile" />
              </button>

              <Link
                href="/auth?mode=signin"
                className="flex-1 rounded-lg bg-white/5 px-4 py-2.5 text-center text-sm font-semibold text-foreground transition hover:bg-white/10"
                onClick={() => setMobileOpen(false)}
              >
                <T k="nav.signIn" fallback="Sign in" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
