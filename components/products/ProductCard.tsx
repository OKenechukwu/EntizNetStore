// components/products/ProductCard.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import Price from "@/components/ui/Price";
import I18nText from "@/components/i18n/I18nText";

export type ProductCardData = {
  id: string | number;
  slug: string;          // e.g. "lelo-sila-2"
  name: string;          // product title
  brand?: string;        // optional brand
  image?: string;        // optional public path or URL
  price: number;         // USD base (number)
  badge?: string;        // optional tag like "New" or "-20%"
  description?: string;  // OPTIONAL: short blurb (shown as 2-line preview)
};

type Props = {
  product: ProductCardData;
  rates: Record<string, number>;
};

/**
 * ROUTE_BASE:
 * We standardize product pages to `/products/[slug]`.
 * If your app still uses `/p/[slug]`, either:
 *  - create `app/products/[slug]/page.tsx`, OR
 *  - change ROUTE_BASE to "/p".
 */
const ROUTE_BASE = "/products";

export default function ProductCard({ product, rates }: Props) {
  const { id, slug, name, brand, image, price, badge, description } = product;

  // Defensive: if slug is missing, fall back to id
  const safeKey = (slug && String(slug).trim()) || String(id);
  const href = `${ROUTE_BASE}/${encodeURIComponent(safeKey)}`;

  return (
    <article
      className="group relative overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.04] backdrop-blur transition hover:bg-white/[0.08]"
      data-product-card
      aria-label={name}
    >
      {/* Click-overlay Link (prevents nested interactive issues) */}
      <Link href={href} className="absolute inset-0 z-10" aria-label={name} />

      {/* Media */}
      <div className="relative aspect-[4/3]">
        <Image
          src={image || "/demo/products/p1.jpg"}
          alt={name}
          fill
          className="object-cover transition will-change-transform group-hover:scale-[1.02]"
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
          priority={false}
        />
        {badge ? (
          <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
            {badge}
          </span>
        ) : null}
      </div>

      {/* Content */}
      <div className="p-3">
        {brand ? (
          <div className="text-[11px] uppercase tracking-wide text-white/60">{brand}</div>
        ) : null}

        {/* Title (translated) */}
        <h3 className="mt-0.5 line-clamp-2 pr-10 text-sm font-semibold">
          <I18nText text={name} />
        </h3>

        {/* 2-line description preview (translated, only if provided) */}
        {description ? (
          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-white/70">
            <I18nText text={description} />
          </p>
        ) : null}

        {/* Price — localized & currency-formatted via reusable component */}
        <div className="mt-2 bg-clip-text text-base font-extrabold text-transparent [background:linear-gradient(135deg,var(--brand-primary),var(--brand-secondary))]">
          <Price amountUSD={Number(price)} rates={rates} />
        </div>
      </div>
    </article>
  );
}

/* Optional: tiny skeleton for loading lists */
export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.04]">
      <div className="aspect-[4/3] animate-pulse bg-white/[0.06]" />
      <div className="p-3">
        <div className="mb-2 h-3 w-16 animate-pulse rounded bg-white/[0.08]" />
        <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-white/[0.08]" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-white/[0.06]" />
        <div className="mt-2 h-5 w-20 animate-pulse rounded bg-white/[0.12]" />
      </div>
    </div>
  );
}
