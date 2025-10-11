"use client";

import Link from "next/link";
import {
  Heart,
  Sparkles,
  Shirt,
  Zap,
  Droplet,
  Shield,
  Star,
  Package,
  Flame,
  Moon,
  Sun,
  Gift,
  Wand2,
  Bath,
  Feather,
  Crown,
} from "lucide-react";

const CATEGORIES = [
  { name: "Vibrators", icon: <Zap className="h-7 w-7" />, href: "/categories/vibrators" },
  { name: "Dildos", icon: <Sparkles className="h-7 w-7" />, href: "/categories/dildos" },
  { name: "Lingerie", icon: <Shirt className="h-7 w-7" />, href: "/categories/lingerie" },
  { name: "Couples", icon: <Heart className="h-7 w-7" />, href: "/categories/couples" },
  { name: "Lubricants", icon: <Droplet className="h-7 w-7" />, href: "/categories/lubricants" },
  { name: "BDSM & Kink", icon: <Flame className="h-7 w-7" />, href: "/categories/bdsm" },
  { name: "Wellness", icon: <Sun className="h-7 w-7" />, href: "/categories/wellness" },
  { name: "Premium", icon: <Crown className="h-7 w-7" />, href: "/categories/premium" },
  { name: "Smart Toys", icon: <Zap className="h-7 w-7" />, href: "/categories/smart-toys" },
  { name: "Massage", icon: <Feather className="h-7 w-7" />, href: "/categories/massage" },
  { name: "Bath & Body", icon: <Bath className="h-7 w-7" />, href: "/categories/bath-body" },
  { name: "Accessories", icon: <Package className="h-7 w-7" />, href: "/categories/accessories" },
  { name: "Essentials", icon: <Shield className="h-7 w-7" />, href: "/categories/essentials" },
  { name: "Luxury Sets", icon: <Gift className="h-7 w-7" />, href: "/categories/luxury-sets" },
  { name: "Fantasy", icon: <Wand2 className="h-7 w-7" />, href: "/categories/fantasy" },
  { name: "Night Care", icon: <Moon className="h-7 w-7" />, href: "/categories/night-care" },
].slice(0, 16); // Ensure exactly 16 items for 2 rows of 8

export default function CategoriesRow() {
  return (
    <section className="w-full px-4 md:px-6 py-6 md:py-8 bg-background">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-secondary">Shop by Category</h2>
        <p className="text-foreground/70 text-sm mt-1">Explore our curated collections</p>
      </div>
      
      {/* Grid: 4 cols mobile, 6 cols tablet, 8 cols desktop → Creates 2 rows of 8 on desktop */}
      <div className="grid gap-3 md:gap-4 grid-cols-4 sm:grid-cols-6 md:grid-cols-8">
        {CATEGORIES.map((category) => (
          <Link
            key={category.name}
            href={category.href}
            className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 transition-transform duration-150 ease-out hover:scale-105 hover:bg-white/10 hover:border-brand-secondary/50"
          >
            <div className="text-foreground/80 transition-colors group-hover:text-brand-secondary">
              {category.icon}
            </div>
            <span className="text-xs font-medium text-center text-foreground/90 transition-colors group-hover:text-brand-secondary">
              {category.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
