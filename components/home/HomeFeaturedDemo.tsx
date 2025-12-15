// components/home/HomeFeaturedDemo.tsx
"use client";

import FeaturedProducts from "@/components/home/FeaturedProducts";

export default function HomeFeaturedDemo() {
  // Generate demo products in BASE currency (USD).
  // Downstream components (ProductCard via FeaturedProducts) will
  // convert/format using BrandProvider currency settings.
  const items = Array.from({ length: 8 }, (_, i) => ({
    id: `feat-${i + 1}`,
    slug: `demo-${i + 1}`,
    name: `Premium Product ${i + 1}`,
    price: Number((Math.random() * 100 + 20).toFixed(2)), // BASE USD
    image: "/attached_assets/stock_images/luxury_adult_product_04d5ddeb.jpg",
  }));

  return <FeaturedProducts items={items} />;
}
