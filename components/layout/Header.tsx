"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Bell,
  Search,
  Menu,
  X,
} from "lucide-react";
import LanguageCurrencyMenu from "./LanguageCurrencyMenu";
import ProfileIconClient from "./ProfileIconClient";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
              Stores
            </Link>
            <Link
              href="/brands"
              className="px-3 py-1.5 text-sm font-medium text-foreground/90 transition hover:text-brand-secondary"
            >
              Brands
            </Link>
            <Link
              href="/live"
              className="px-3 py-1.5 text-sm font-medium text-foreground/90 transition hover:text-brand-secondary"
            >
              Live
            </Link>
            <Link
              href="/on-sale"
              className="px-3 py-1.5 text-sm font-medium text-foreground/90 transition hover:text-brand-secondary"
            >
              On Sale
            </Link>
            <Link
              href="/learn"
              className="px-3 py-1.5 text-sm font-medium text-foreground/90 transition hover:text-brand-secondary"
            >
              Learn
            </Link>
          </nav>

          {/* Search Bar - Compact */}
          <div className="hidden md:flex flex-1 max-w-[520px] lg:max-w-[520px]">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
              <input
                type="search"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-foreground/50 focus:border-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-secondary/20"
              />
            </div>
          </div>

          {/* Right: Language + Icons */}
          <div className="hidden md:flex items-center gap-2 ml-auto">
            <LanguageCurrencyMenu />
            
            <Link
              href="/auth?mode=signin"
              className="rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10"
            >
              Sign in
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
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* MainNav - Category Tabs */}
      <div className="hidden md:flex w-full items-center justify-center gap-6 border-t border-white/10 bg-background/70 px-4 py-2.5">
        <Link
          href="/"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10 hover:text-brand-secondary"
        >
          Home
        </Link>
        <Link
          href="/premium"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10 hover:text-brand-secondary"
        >
          Premium
        </Link>
        <Link
          href="/luxury"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10 hover:text-brand-secondary"
        >
          Luxury
        </Link>
        <Link
          href="/collections"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10 hover:text-brand-secondary"
        >
          Collections
        </Link>
        <Link
          href="/smart-devices"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10 hover:text-brand-secondary"
        >
          Smart Devices
        </Link>
        <Link
          href="/gift-sets"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10 hover:text-brand-secondary"
        >
          Gift Sets
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
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-foreground/50 focus:border-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-secondary/20"
              />
            </div>

            {/* Mobile Navigation */}
            <div className="flex flex-col gap-2">
              {[
                { href: "/", label: "Home" },
                { href: "/premium", label: "Premium" },
                { href: "/luxury", label: "Luxury" },
                { href: "/collections", label: "Collections" },
                { href: "/smart-devices", label: "Smart Devices" },
                { href: "/gift-sets", label: "Gift Sets" },
                { href: "/stores", label: "Stores" },
                { href: "/brands", label: "Brands" },
                { href: "/live", label: "Live" },
                { href: "/on-sale", label: "On Sale" },
                { href: "/learn", label: "Learn" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg bg-white/5 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-white/10"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Mobile Actions */}
            <div className="flex items-center gap-2 pt-2">
              <LanguageCurrencyMenu />
              <Link
                href="/auth?mode=signin"
                className="flex-1 rounded-lg bg-brand-secondary px-4 py-2.5 text-center text-sm font-semibold text-background transition hover:opacity-90"
                onClick={() => setMobileOpen(false)}
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
