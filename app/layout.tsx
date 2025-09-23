// app/layout.tsx
import type { Metadata } from "next";
import Link from "next/link";
import CartLink from "@/components/CartLink";
import ThemeToggle from "@/components/ThemeToggle";
import { ThemeProvider } from "@/components/ThemeProvider";
import AgeGate from "@/components/AgeGate";
import "./globals.css";

export const metadata: Metadata = {
  title: "EntizNet Store - Luxury Adult Marketplace",
  description: "Premium adult products and experiences. Discrete, luxury, authentic.",
  keywords: "adult marketplace, luxury products, discrete shopping",
  robots: "noindex, nofollow", // Adult content - no indexing
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <ThemeProvider>
          <AgeGate>
            <div className="min-h-screen transition-colors duration-300">
              <header className="glass-card sticky top-0 z-40 border-b border-opacity-20">
                <nav className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-8">
                    <Link 
                      href="/" 
                      className="font-serif font-bold text-2xl text-accent-gold hover:opacity-80 transition-opacity"
                    >
                      EntizNet
                    </Link>
                    <div className="flex items-center gap-6 text-sm font-medium">
                      <Link href="/store" className="hover:text-accent-gold transition-colors">
                        Store
                      </Link>
                      <Link href="/categories" className="hover:text-accent-gold transition-colors">
                        Categories
                      </Link>
                      <Link href="/brands" className="hover:text-accent-gold transition-colors">
                        Brands
                      </Link>
                      <Link href="/popular" className="hover:text-accent-gold transition-colors">
                        Popular
                      </Link>
                      <Link href="/on-sale" className="hover:text-accent-gold transition-colors">
                        On Sale
                      </Link>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <ThemeToggle />
                    <CartLink />
                    <Link 
                      href="/auth/sign-in" 
                      className="luxury-button-outline text-sm px-4 py-2"
                    >
                      Sign In
                    </Link>
                  </div>
                </nav>
              </header>

              <main className="mx-auto max-w-7xl px-6 py-8">
                {children}
              </main>
              
              <footer className="border-t border-opacity-20 mt-20">
                <div className="mx-auto max-w-7xl px-6 py-12">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div>
                      <h3 className="font-serif font-bold text-xl text-accent-gold mb-4">
                        EntizNet
                      </h3>
                      <p className="text-sm opacity-80">
                        Premium adult marketplace with discrete, luxury shopping experience.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-4">Shop</h4>
                      <div className="space-y-2 text-sm">
                        <Link href="/categories" className="block hover:text-accent-gold transition-colors">
                          All Categories
                        </Link>
                        <Link href="/popular" className="block hover:text-accent-gold transition-colors">
                          Popular Items
                        </Link>
                        <Link href="/on-sale" className="block hover:text-accent-gold transition-colors">
                          Sale Items
                        </Link>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-4">Support</h4>
                      <div className="space-y-2 text-sm">
                        <Link href="/help" className="block hover:text-accent-gold transition-colors">
                          Help Center
                        </Link>
                        <Link href="/shipping" className="block hover:text-accent-gold transition-colors">
                          Shipping Info
                        </Link>
                        <Link href="/returns" className="block hover:text-accent-gold transition-colors">
                          Returns
                        </Link>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-4">Account</h4>
                      <div className="space-y-2 text-sm">
                        <Link href="/dashboard" className="block hover:text-accent-gold transition-colors">
                          Dashboard
                        </Link>
                        <Link href="/orders" className="block hover:text-accent-gold transition-colors">
                          Orders
                        </Link>
                        <Link href="/settings" className="block hover:text-accent-gold transition-colors">
                          Settings
                        </Link>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t border-opacity-20 mt-8 pt-8 text-center text-sm opacity-60">
                    <p>&copy; 2025 EntizNet. All rights reserved. Must be 18+ to access.</p>
                  </div>
                </div>
              </footer>
            </div>
          </AgeGate>
        </ThemeProvider>
      </body>
    </html>
  );
}
