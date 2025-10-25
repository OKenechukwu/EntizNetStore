// components/products/ProductsGrid.tsx
"use client";

import ProductCard, {
  ProductCardData,
} from "@/components/products/ProductsCard";

/**
 * A simple responsive grid for displaying product cards.
 * Reusable across category pages, homepage, and search results.
 *
 * Accepts `rates` (FX rates) and passes them to each ProductCard.
 */

type Props = {
  products: ProductCardData[];
  rates: Record<string, number>;
  title?: string; // optional title above the grid
  columns?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
};

export default function ProductsGrid({
  products,
  rates,
  title,
  columns = { sm: 2, md: 3, lg: 4, xl: 5 },
}: Props) {
  const gridCols = `
    grid grid-cols-2 gap-4
    sm:grid-cols-${columns.sm ?? 2}
    md:grid-cols-${columns.md ?? 3}
    lg:grid-cols-${columns.lg ?? 4}
    xl:grid-cols-${columns.xl ?? 5}
  `;

  return (
    <section className="w-full">
      {title && (
        <h2 className="mb-4 text-[22px] font-extrabold tracking-tight">
          {title}
        </h2>
      )}

      {products && products.length > 0 ? (
        <div className={gridCols}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} rates={rates} />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-white/60">
          No products available in this category.
        </div>
      )}
    </section>
  );
}
