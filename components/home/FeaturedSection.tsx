"use client";

import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";

interface FeaturedProduct {
  id: string;
  title: string;
  price: string;
  image?: string;
  rating?: number;
  href: string;
}

interface FeaturedSectionProps {
  title: string;
  items: FeaturedProduct[];
  viewAllHref?: string;
}

export default function FeaturedSection({ title, items, viewAllHref }: FeaturedSectionProps) {
  return (
    <section className="w-full px-4 md:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-foreground">{title}</h2>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-sm font-medium text-brand-secondary hover:underline"
          >
            View All →
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {items.map((item) => (
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
              <div className="flex items-center gap-1">
                {item.rating && (
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-brand-secondary text-brand-secondary" />
                    <span className="text-xs text-foreground/70">{item.rating}</span>
                  </div>
                )}
              </div>
              <p className="text-sm font-bold text-brand-secondary">{item.price}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
