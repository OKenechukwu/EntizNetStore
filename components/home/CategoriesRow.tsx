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
  Sun,
  Wand2,
  Bath,
  Feather,
  Crown,
} from "lucide-react";
import { T, useI18n } from "@/components/i18n/I18nProvider";
import I18nText from "@/components/i18n/I18nText";

const CATEGORIES = [
  { name: "Vibrators", icon: <Zap className="h-7 w-7" />, href: "/categories/vibrators" },
  { name: "Dildos", icon: <Sparkles className="h-7 w-7" />, href: "/categories/dildos" },
  { name: "Lingerie", icon: <Shirt className="h-7 w-7" />, href: "/categories/lingerie-and-costumes" },
  { name: "Couples", icon: <Heart className="h-7 w-7" />, href: "/categories/couple-essentials" },
  { name: "Lubricants", icon: <Droplet className="h-7 w-7" />, href: "/categories/lubricants-and-perfumes" },
  { name: "BDSM", icon: <Flame className="h-7 w-7" />, href: "/categories/fetish-and-bdsm-gear" },
  { name: "Wellness", icon: <Sun className="h-7 w-7" />, href: "/categories/health-and-hygiene" },
  { name: "Luxury", icon: <Crown className="h-7 w-7" />, href: "/categories/luxury-and-collectibles" },
  { name: "Smart Toys", icon: <Zap className="h-7 w-7" />, href: "/categories/app-and-smart-toys" },
  { name: "Massage", icon: <Feather className="h-7 w-7" />, href: "/categories/massage-oils-and-creams" },
  { name: "Condoms", icon: <Shield className="h-7 w-7" />, href: "/categories/condoms" },
  { name: "Sex Toys", icon: <Package className="h-7 w-7" />, href: "/categories/sex-toys" },
  { name: "Essentials", icon: <Bath className="h-7 w-7" />, href: "/categories/essentials" },
  { name: "Supplements", icon: <Star className="h-7 w-7" />, href: "/categories/supplements-and-enhancers" },
  { name: "Candles", icon: <Flame className="h-7 w-7" />, href: "/categories/candles-and-atmosphere" },
  { name: "Education", icon: <Wand2 className="h-7 w-7" />, href: "/categories/education-and-accessories" },
].slice(0, 16);

export default function CategoriesRow() {
  return (
    <section className="w-full px-4 md:px-6 py-6 md:py-8 bg-background">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-secondary">
          <T k="common.shopByCategory" fallback="Shop by Category" />
        </h2>
        <p className="text-foreground/70 text-sm mt-1">
          <T k="common.exploreCurated" fallback="Explore our curated collections" />
        </p>
      </div>

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
              <I18nText text={category.name} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
