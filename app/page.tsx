"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import HeroSlider from "@/components/hero/HeroSlider";
import CategoriesRow from "@/components/home/CategoriesRow";
import FeaturedSection from "@/components/home/FeaturedSection";

const DEMO_PRODUCTS = Array.from({ length: 6 }, (_, i) => ({
  id: `product-${i + 1}`,
  title: `Premium Product ${i + 1}`,
  price: `$${(Math.random() * 100 + 20).toFixed(2)}`,
  rating: parseFloat((Math.random() * 2 + 3).toFixed(1)),
  href: `/products/demo-${i + 1}`,
  image: `/attached_assets/stock_images/luxury_adult_product_04d5ddeb.jpg`
}));

export default function HomePage() {
  const { t } = useI18n();
  
  return (
    <div className="w-full">
      {/* Hero Slider - Full width, directly under MainNav */}
      <HeroSlider />

      {/* Categories - Exactly 2 rows of 8 (16 total) */}
      <CategoriesRow />

      {/* Featured Sections - 9 sections in specified order */}
      <div className="space-y-6 pb-12">
        <FeaturedSection
          title={t("home.bestSellingProducts")}
          items={DEMO_PRODUCTS}
          viewAllHref="/store"
        />

        <FeaturedSection
          title="Top Sellers"
          items={DEMO_PRODUCTS}
          viewAllHref="/store"
        />

        <FeaturedSection
          title="Top Sellers in Dildos for you"
          items={DEMO_PRODUCTS}
          viewAllHref="/categories/dildos"
        />

        <FeaturedSection
          title="Top categories in Vibrator"
          items={DEMO_PRODUCTS}
          viewAllHref="/categories/vibrators"
        />

        <FeaturedSection
          title="International top sellers in Dolls"
          items={DEMO_PRODUCTS}
          viewAllHref="/categories/dolls"
        />

        <FeaturedSection
          title="Best Sellers in Beauty & Personal Care"
          items={DEMO_PRODUCTS}
          viewAllHref="/categories/beauty"
        />

        <FeaturedSection
          title="Popular products in Essentials internationally"
          items={DEMO_PRODUCTS}
          viewAllHref="/categories/essentials"
        />

        <FeaturedSection
          title="Local top sellers"
          items={DEMO_PRODUCTS}
          viewAllHref="/store"
        />

        <FeaturedSection
          title="International top sellers"
          items={DEMO_PRODUCTS}
          viewAllHref="/store"
        />
      </div>
    </div>
  );
}
