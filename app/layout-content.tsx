"use client";

import Link from "next/link";
import CartLink from "@/components/CartLink";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageCurrencySwitcher from "@/components/LanguageCurrencySwitcher";
import { ThemeProvider } from "@/components/ThemeProvider";
import { BrandProvider, useBrand } from "@/components/BrandProvider";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { NotificationProvider } from "@/components/notifications/NotificationProvider";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";
import AgeGate from "@/components/AgeGate";
import { useTranslation } from "@/hooks/useTranslation";

function BrandSwitcher() {
  const { brand, setBrand } = useBrand();
  
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setBrand("entiznetstore")}
        className={`text-xs px-3 py-1 rounded-full transition-colors ${
          brand === "entiznetstore" 
            ? "bg-accent-gold text-primary-black" 
            : "border border-accent-gold text-accent-gold hover:bg-accent-gold hover:text-primary-black"
        }`}
      >
        EntizNet
      </button>
      <button
        onClick={() => setBrand("primediscreet")}
        className={`text-xs px-3 py-1 rounded-full transition-colors ${
          brand === "primediscreet" 
            ? "bg-accent-gold text-primary-black" 
            : "border border-accent-gold text-accent-gold hover:bg-accent-gold hover:text-primary-black"
        }`}
      >
        PrimeDiscreet
      </button>
    </div>
  );
}

function Navigation() {
  const { config } = useBrand();
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  
  return (
    <header className="glass-card sticky top-0 z-40 border-b border-opacity-20">
      <nav className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <Link 
            href="/" 
            className="font-serif font-bold text-2xl text-accent-gold hover:opacity-80 transition-opacity"
          >
            {config.name}
          </Link>
          <div className="flex items-center gap-6 text-sm font-medium">
            <Link href="/store" className="hover:text-accent-gold transition-colors">
              {t('store')}
            </Link>
            <Link href="/categories" className="hover:text-accent-gold transition-colors">
              {t('categories')}
            </Link>
            <Link href="/brands" className="hover:text-accent-gold transition-colors">
              {t('brands')}
            </Link>
            <Link href="/popular" className="hover:text-accent-gold transition-colors">
              {t('popular')}
            </Link>
            <Link href="/on-sale" className="hover:text-accent-gold transition-colors">
              {t('onSale')}
            </Link>
            <Link href="/platform" className="hover:text-accent-gold transition-colors">
              {t('experience')}
            </Link>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <LanguageCurrencySwitcher />
          <BrandSwitcher />
          <ThemeToggle />
          {user && <NotificationDropdown />}
          <CartLink />
          {user ? (
            <div className="flex items-center gap-4">
              <Link 
                href="/dashboard"
                className="text-sm hover:text-accent-gold transition-colors"
              >
                {t('dashboard')}
              </Link>
              <button
                onClick={signOut}
                className="luxury-button-outline text-sm px-4 py-2"
              >
                {t('signOut')}
              </button>
            </div>
          ) : (
            <Link 
              href="/auth/sign-in" 
              className="luxury-button-outline text-sm px-4 py-2"
            >
              {t('signIn')}
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

function Footer() {
  const { config } = useBrand();
  
  return (
    <footer className="border-t border-opacity-20 mt-20">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <h3 className="font-serif font-bold text-xl text-accent-gold">
              {config.name}
            </h3>
            <p className="text-sm opacity-80">
              {config.description}
            </p>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-semibold text-accent-gold">Shop</h4>
            <div className="space-y-2 text-sm">
              <Link href="/categories" className="block hover:text-accent-gold transition-colors">Categories</Link>
              <Link href="/brands" className="block hover:text-accent-gold transition-colors">Brands</Link>
              <Link href="/popular" className="block hover:text-accent-gold transition-colors">Popular</Link>
              <Link href="/on-sale" className="block hover:text-accent-gold transition-colors">Sale</Link>
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-semibold text-accent-gold">Support</h4>
            <div className="space-y-2 text-sm">
              <Link href="/help" className="block hover:text-accent-gold transition-colors">Help Center</Link>
              <Link href="/privacy" className="block hover:text-accent-gold transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="block hover:text-accent-gold transition-colors">Terms of Service</Link>
              <Link href="/contact" className="block hover:text-accent-gold transition-colors">Contact</Link>
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-semibold text-accent-gold">Sellers</h4>
            <div className="space-y-2 text-sm">
              <Link href="/seller/apply" className="block hover:text-accent-gold transition-colors">Become a Seller</Link>
              <Link href="/seller/dashboard" className="block hover:text-accent-gold transition-colors">Seller Dashboard</Link>
              <Link href="/seller/help" className="block hover:text-accent-gold transition-colors">Seller Resources</Link>
            </div>
          </div>
        </div>
        
        <div className="border-t border-opacity-20 mt-12 pt-8 text-center text-sm opacity-60">
          <p>&copy; 2025 {config.name}. All rights reserved. Must be 18+ to access.</p>
        </div>
      </div>
    </footer>
  );
}

export function LayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <BrandProvider>
        <AuthProvider>
          <NotificationProvider>
            <AgeGate>
            <div className="min-h-screen transition-colors duration-300">
              <Navigation />
              <main className="mx-auto max-w-7xl px-6 py-8">
                {children}
              </main>
              <Footer />
            </div>
            </AgeGate>
          </NotificationProvider>
        </AuthProvider>
      </BrandProvider>
    </ThemeProvider>
  );
}