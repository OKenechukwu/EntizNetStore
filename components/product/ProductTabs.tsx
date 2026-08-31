// components/product/ProductTabs.tsx
"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import type { Product } from "@/types/product";
import ProductCard from "@/components/products/ProductCard";

type TabType = "reviews" | "details" | "recommendations";

type Props = {
  product: Product;
  recommendations?: Product[];
};

export default function ProductTabs({ product, recommendations = [] }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("reviews");

  const tabs: { key: TabType; label: string }[] = [
    { key: "reviews", label: "Reviews" },
    { key: "details", label: "Product Details" },
    { key: "recommendations", label: "Recommendations" },
  ];

  return (
    <div className="min-w-0 w-full">
      {/* Keep the tab rail inside the viewport on phones instead of allowing
          its intrinsic text width to widen the entire document. */}
      <div className="max-w-full overflow-x-auto overscroll-x-contain border-b border-white/10">
        <div className="flex min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`
                shrink-0 whitespace-nowrap px-4 py-3 text-sm font-semibold transition sm:px-6
                ${
                  activeTab === tab.key
                    ? "border-b-2 border-brand-secondary text-brand-secondary"
                    : "text-foreground opacity-70 hover:opacity-100"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-w-0 py-6">
        {activeTab === "reviews" && <ReviewsTab product={product} />}
        {activeTab === "details" && <DetailsTab product={product} />}
        {activeTab === "recommendations" && <RecommendationsTab products={recommendations} />}
      </div>
    </div>
  );
}

function ReviewsTab({ product }: { product: Product }) {
  const [filter, setFilter] = useState<"all" | "images" | "5star" | "4star" | "3star" | "2star" | "1star">("all");

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex min-w-0 flex-col items-stretch gap-4 rounded-xl bg-white/5 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        <div className="text-center">
          <div className="text-5xl font-bold text-brand-secondary">
            {product.rating?.toFixed(1) || "0.0"}
          </div>
          <div
            className="mt-1 flex justify-center"
            role="img"
            aria-label={`${product.rating?.toFixed(1) || "0.0"} out of 5 stars`}
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                aria-hidden="true"
                className={`h-4 w-4 ${
                  i <= (product.rating || 0)
                    ? "fill-brand-secondary text-brand-secondary"
                    : "text-foreground opacity-30"
                }`}
              />
            ))}
          </div>
          <div className="mt-1 text-sm text-foreground opacity-70">{product.reviewCount || 0} reviews</div>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          {[5, 4, 3, 2, 1].map((stars) => {
            const percent = 20; // Mock data - would calculate from actual reviews
            return (
              <div key={stars} className="flex min-w-0 items-center gap-2 text-sm">
                <div className="flex w-16 shrink-0 items-center gap-1">
                  <span>{stars}</span>
                  <Star aria-hidden="true" className="h-3 w-3 fill-brand-secondary text-brand-secondary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="h-2 rounded-full bg-foreground/10" aria-hidden="true">
                    <div
                      className="h-2 rounded-full bg-brand-secondary"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
                <div className="w-12 shrink-0 text-right text-foreground opacity-70">{percent}%</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: "all" as const, label: "All" },
          { key: "images" as const, label: "With Images/Video" },
          { key: "5star" as const, label: "5 Stars" },
          { key: "4star" as const, label: "4 Stars" },
          { key: "3star" as const, label: "3 Stars" },
          { key: "2star" as const, label: "2 Stars" },
          { key: "1star" as const, label: "1 Star" },
        ].map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`
              rounded-lg border px-4 py-2 text-sm transition
              ${
                filter === f.key
                  ? "border-brand-secondary bg-brand-secondary/10 text-brand-secondary"
                  : "border-white/10 hover:border-white/30"
              }
            `}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div className="py-8 text-center text-foreground opacity-70">
          No reviews yet. Be the first to review this product!
        </div>
      </div>
    </div>
  );
}

function DetailsTab({ product }: { product: Product }) {
  return (
    <div className="prose min-w-0 max-w-none break-words text-foreground">
      {product.detailsHtml ? (
        <div dangerouslySetInnerHTML={{ __html: product.detailsHtml }} />
      ) : product.description ? (
        <p className="text-foreground opacity-80">{product.description}</p>
      ) : (
        <p className="text-foreground opacity-70">No product details available.</p>
      )}
    </div>
  );
}

function RecommendationsTab({ products }: { products: Product[] }) {
  if (!products || products.length === 0) {
    return (
      <div className="py-8 text-center text-foreground opacity-70">
        No recommendations available at this time.
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <h3 className="mb-4 text-lg font-semibold">You may also like these products</h3>
      <div className="grid min-w-0 grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={{
              id: p.id,
              slug: p.slug,
              name: p.title,
              brand: p.brand?.name,
              image: p.images[0]?.url,
              price: p.basePrice,
            }}
            rates={{}}
          />
        ))}
      </div>
    </div>
  );
}
