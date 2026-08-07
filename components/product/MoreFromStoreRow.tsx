// components/product/MoreFromStoreRow.tsx
"use client";

import Link from "next/link";
import ProductCard from "@/components/products/ProductCard";
import type { Product } from "@/types/product";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

type Props = {
  storeName: string;
  storeSlug: string;
  products: Product[];
};

export default function MoreFromStoreRow({ storeName, storeSlug, products }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (!products || products.length === 0) return null;

  return (
    <div className="w-full py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">
          More from{" "}
          <Link href={`/store/${storeSlug}`} className="text-brand-secondary hover:underline">
            {storeName}
          </Link>
        </h2>
        <div className="flex items-center gap-4">
          <Link
            href={`/store/${storeSlug}`}
            className="text-sm text-brand-secondary hover:underline"
          >
            View Store
          </Link>
          <div className="flex gap-2">
            <button
              onClick={() => scroll("left")}
              className="rounded-full border border-white/10 p-2 hover:bg-white/5"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="rounded-full border border-white/10 p-2 hover:bg-white/5"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth pb-4 scrollbar-hide"
      >
        {products.map((product) => (
          <div key={product.id} className="min-w-[200px] flex-shrink-0 md:min-w-[250px]">
            <ProductCard
              product={{
                id: product.id,
                slug: product.slug,
                name: product.title,
                brand: product.brand?.name,
                image: product.images[0]?.url,
                price: product.basePrice,
              }}
              rates={{}}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
