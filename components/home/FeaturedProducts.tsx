// components/home/FeaturedProducts.tsx
"use client";

import ProductCard, {
  type ProductCardData,
} from "@/components/products/ProductCard";

/**
 * Accepts a loose "items" shape (legacy-friendly) and normalizes it to ProductCardData.
 * Supported incoming fields per item:
 *  - id
 *  - slug | href (we derive slug from href if provided)
 *  - name | title
 *  - price | priceUSD | priceUsd | priceEUR | priceEur (we'll coerce to BASE number)
 *  - image
 *  - brand (optional)
 *  - badge (optional)
 *  - description (optional)
 */
type IncomingItem = {
  id?: string | number;
  slug?: string;
  href?: string;
  name?: string;
  title?: string;
  price?: number | string;
  priceUSD?: number | string;
  priceUsd?: number | string;
  priceEUR?: number | string;
  priceEur?: number | string;
  image?: string;
  brand?: string;
  badge?: string;
  description?: string;
};

export default function FeaturedProducts({ items }: { items: IncomingItem[] }) {
  const normalized: ProductCardData[] = (items || []).map((r, idx) => {
    const rawPrice =
      r.price ?? r.priceUSD ?? r.priceUsd ?? r.priceEUR ?? r.priceEur ?? 0;

    // Coerce to number; ProductCard will handle conversion/formatting.
    const basePrice =
      typeof rawPrice === "string" ? Number(rawPrice) : Number(rawPrice);

    // Derive a slug if missing
    const slugFromHref = r.href
      ? r.href.split("/").filter(Boolean).pop()
      : undefined;
    const slug = r.slug ?? slugFromHref ?? `item-${r.id ?? idx + 1}`;

    return {
      id: (r.id ?? slug) as string | number,
      slug,
      name: r.name ?? r.title ?? "Untitled",
      image: r.image,
      price: isNaN(basePrice) ? 0 : basePrice,
      brand: r.brand,
      badge: r.badge,
      description: r.description,
    };
  });

  return (
    <section className="w-full py-8">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {normalized.map((p) => (
            <ProductCard key={`${p.id}`} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
