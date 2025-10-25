// components/product/ProductDetails.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useBrand } from "@/components/BrandProvider";
import ProductGallery from "@/components/product/ProductGallery"; // adapter -> products/ProductMedia
import StorePanel from "@/components/store/StorePanel";
import ProductDetailsTabs from "@/components/product/ProductDetailsTabs";
import Link from "next/link";
import Price from "@/components/ui/Price";

type FxRates = Record<string, number> | null;

export interface PDPImage {
  src: string;
  alt?: string;
}

export interface PDPStore {
  id: string;
  name: string;
  rating?: number;
  reviews_count?: number;
  followers?: number;
  response_time?: string;
  verified?: boolean;
}

export interface PDPProps {
  title: string;
  description: string;
  images: PDPImage[];
  // NOTE: keep price in the same unit your <Price/> expects (USD in your current setup)
  priceUSD: number;
  discountLabel?: string; // e.g., "-20% Today"
  voucherLabel?: string;  // e.g., "Voucher SAVE10"
  store: PDPStore;
  // Optional: extra sections for the tabs component
  detailsHtml?: string;    // product specs HTML
  shippingHtml?: string;   // shipping/return HTML
  reviews?: Array<{
    id: string;
    user: string;
    rating: number;
    text: string;
    date?: string;
    images?: string[];
  }>;
}

function PromoBadges({ discountLabel, voucherLabel }: { discountLabel?: string; voucherLabel?: string }) {
  if (!discountLabel && !voucherLabel) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {discountLabel && (
        <span className="rounded-md bg-red-600/10 px-2 py-1 text-xs font-semibold text-red-700">
          {discountLabel}
        </span>
      )}
      {voucherLabel && (
        <span className="rounded-md bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-700">
          {voucherLabel}
        </span>
      )}
    </div>
  );
}

export default function ProductDetails({
  title,
  description,
  images,
  priceUSD,
  discountLabel,
  voucherLabel,
  store,
  detailsHtml,
  shippingHtml,
  reviews = [],
}: PDPProps) {
  const { theme } = useBrand();
  const [rates, setRates] = useState<FxRates>(null); // used by <Price/>

  // fetch FX rates once (keeps currency consistent with your Search page)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/currency/rates?base=USD", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed FX");
        const json = await res.json();
        if (mounted) setRates(json?.rates ?? null);
      } catch {
        if (mounted) setRates(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const heroImages = useMemo(
    () => (images?.length ? images : [{ src: "/attached_assets/stock_images/luxury_adult_product_04d5ddeb.jpg" }]),
    [images]
  );

  return (
    <div className="mx-auto max-w-6xl gap-8 px-4 py-8 lg:grid lg:grid-cols-12">
      {/* Left: media */}
      <div className="lg:col-span-6">
        <ProductGallery images={heroImages} />
      </div>

      {/* Right: summary */}
      <div className="lg:col-span-6">
        <h1 className="mb-2 text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
          {title}
        </h1>

        <PromoBadges discountLabel={discountLabel} voucherLabel={voucherLabel} />

        <div className="mb-4 text-2xl font-bold" style={{ color: theme.colors.accent }}>
          <Price amountUSD={priceUSD} rates={rates ?? undefined} />
        </div>

        <p className="mb-6 text-sm leading-relaxed" style={{ color: theme.colors.text.secondary }}>
          {description}
        </p>

        <div className="mb-6 flex gap-2">
          <button
            className="rounded-md px-5 py-2 text-white"
            style={{ backgroundColor: theme.colors.accent }}
          >
            Add to Cart
          </button>
          <button
            className="rounded-md border px-5 py-2 hover:opacity-90"
            style={{ borderColor: theme.colors.accent, color: theme.colors.accent }}
          >
            Buy Now
          </button>
        </div>

        {/* Reusable store card */}
        <StorePanel
          storeId={store.id}
          storeName={store.name}
          rating={store.rating}
          reviewsCount={store.reviews_count}
          followers={store.followers}
          responseTime={store.response_time}
          verified={store.verified ?? true}
          className="mb-4"
        />
      </div>

      {/* Tabs (Details / Shipping / Reviews) */}
      <div className="mt-8 lg:col-span-12">
        <ProductDetailsTabs
          // Make sure your existing tabs component accepts these props;
          // if prop names differ, tell me and I’ll map them.
          detailsHtml={detailsHtml}
          shippingHtml={shippingHtml}
          reviews={reviews}
        />
      </div>
    </div>
  );
}
