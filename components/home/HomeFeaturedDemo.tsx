// components/home/HomeFeaturedDemo.tsx
"use client";

import FeaturedProducts from "@/components/home/FeaturedProducts";

export default function HomeFeaturedDemo() {
  const items = Array.from({ length: 8 }, (_, i) => ({
    id: `feat-${i + 1}`,
    title: `Premium Product ${i + 1}`,
    priceEUR: Math.round((Math.random() * 100 + 20) * 100) / 100,
    image: "/attached_assets/stock_images/luxury_adult_product_04d5ddeb.jpg",
  }));

  return <FeaturedProducts items={items} />;
}
