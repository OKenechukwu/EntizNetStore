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
    <div className="w-full">
      {/* Tab Headers */}
      <div className="flex border-b border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`
              px-6 py-3 text-sm font-semibold transition
              ${
                activeTab === tab.key
                  ? "border-b-2 border-brand-secondary text-brand-secondary"
                  : "text-white/60 hover:text-white/80"
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="py-6">
        {activeTab === "reviews" && <ReviewsTab product={product} />}
        {activeTab === "details" && <DetailsTab product={product} />}
        {activeTab === "recommendations" && <RecommendationsTab products={recommendations} />}
      </div>
    </div>
  );
}

// Reviews Tab
function ReviewsTab({ product }: { product: Product }) {
  const [filter, setFilter] = useState<"all" | "images" | "5star" | "4star" | "3star" | "2star" | "1star">("all");

  return (
    <div className="space-y-6">
      {/* Rating Summary */}
      <div className="flex items-center gap-6 rounded-xl bg-white/5 p-6">
        <div className="text-center">
          <div className="text-5xl font-bold text-brand-secondary">
            {product.rating?.toFixed(1) || "0.0"}
          </div>
          <div className="mt-1 flex justify-center">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${
                  i <= (product.rating || 0)
                    ? "fill-brand-secondary text-brand-secondary"
                    : "text-white/20"
                }`}
              />
            ))}
          </div>
          <div className="mt-1 text-sm text-white/60">{product.reviewCount || 0} reviews</div>
        </div>

        <div className="flex-1 space-y-2">
          {[5, 4, 3, 2, 1].map((stars) => {
            const percent = 20; // Mock data - would calculate from actual reviews
            return (
              <div key={stars} className="flex items-center gap-2 text-sm">
                <div className="flex w-16 items-center gap-1">
                  <span>{stars}</span>
                  <Star className="h-3 w-3 fill-brand-secondary text-brand-secondary" />
                </div>
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-brand-secondary"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
                <div className="w-12 text-right text-white/60">{percent}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
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

      {/* Reviews List */}
      <div className="space-y-4">
        <div className="text-center text-white/40 py-8">
          No reviews yet. Be the first to review this product!
        </div>
      </div>
    </div>
  );
}

// Details Tab
function DetailsTab({ product }: { product: Product }) {
  return (
    <div className="prose prose-invert max-w-none">
      {product.detailsHtml ? (
        <div dangerouslySetInnerHTML={{ __html: product.detailsHtml }} />
      ) : product.description ? (
        <p className="text-white/80">{product.description}</p>
      ) : (
        <p className="text-white/40">No product details available.</p>
      )}
    </div>
  );
}

// Recommendations Tab
function RecommendationsTab({ products }: { products: Product[] }) {
  if (!products || products.length === 0) {
    return (
      <div className="text-center text-white/40 py-8">
        No recommendations available at this time.
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold">You may also like these products</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
            rates={{}} // Will use CurrencyProvider rates
          />
        ))}
      </div>
    </div>
  );
}
