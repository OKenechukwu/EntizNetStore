// components/category/CategoryGrid.tsx
"use client";

import ProductCard, { ProductCardData } from "@/components/products/ProductCard";

export default function CategoryGrid({
  products,
  rates,
}: {
  products: ProductCardData[];
  rates: Record<string, number>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} rates={rates} />
      ))}
    </div>
  );
}
