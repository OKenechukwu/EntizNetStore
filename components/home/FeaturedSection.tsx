// components/home/FeaturedSection.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";
import { T } from "@/components/i18n/I18nProvider";
import { useBrand } from "@/components/providers/BrandProvider";
import { convertFromBase, formatPrice } from "@/lib/currency";

interface FeaturedProduct {
  id: string;
  title: string;
  price: number;     // stored in BASE currency (USD by default)
  image?: string;
  rating?: number;
  href: string;      // e.g. `/products/slug`
}

interface FeaturedSectionProps {
  title?: string;
  titleKey?: string;
  titleFallback?: string;
  items: FeaturedProduct[];
  viewAllHref?: string;
  locale?: string;
  currency?: string;
  rates?: any;
}

export default function FeaturedSection({
  title,
  titleKey,
  titleFallback,
  items,
  viewAllHref,
}: FeaturedSectionProps) {
  const { currency, fx } = useBrand();

  return (
    <section className="w-full px-4 md:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        {/* Translated title with fallback to prop */}
        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          {titleKey ? <T k={titleKey} fallback={titleFallback || title || ""} /> : (title || titleFallback || "")}
        </h2>

        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-sm font-medium text-brand-secondary hover:underline"
          >
            <T k="category.viewAll" fallback="View All →" />
          </Link>
        )}
      </div>

      {/* Full-width responsive grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {items.map((item) => {
          const converted = convertFromBase(Number(item.price || 0), currency, fx);
          const formatted = formatPrice(converted, currency);

          return (
            <Link
              key={item.id}
              href={item.href}
              className="group flex flex-col gap-2 rounded-xl border border-white/10 bg-card p-3 transition-all duration-150 ease-out hover:scale-[1.02] hover:border-brand-secondary/50"
            >
              <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-foreground/30">
                    <span className="text-3xl">📦</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-medium text-foreground line-clamp-2">
                  {item.title}
                </h3>

                {typeof item.rating === "number" && item.rating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-current text-yellow-400" />
                    <span className="text-xs text-foreground/70">
                      {item.rating.toFixed(1)}
                    </span>
                  </div>
                )}

                {/* Gold price, converted & formatted */}
                <p className="text-sm font-bold text-[#D4AF37]">
                  {formatted}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
