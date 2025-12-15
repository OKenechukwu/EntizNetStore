// app/page.tsx
import FeaturedSection from "@/components/home/FeaturedSection";
import HeroSlider from "@/components/hero/HeroSlider";
import CategoriesRow from "@/components/home/CategoriesRow";
import { cookies } from "next/headers";
import {
  DEFAULT_CURRENCY,
  type SupportedCurrency,
  type FxRates,
} from "@/lib/currency";

const DEMO_IMAGE =
  "/attached_assets/stock_images/luxury_adult_product_04d5ddeb.jpg";

// Demo items use USD as base; FeaturedSection handles conversion/formatting
const DEMO_PRODUCTS = Array.from({ length: 6 }, (_, i) => ({
  id: `product-${i + 1}`,
  title: `Premium Product ${i + 1}`,
  priceUSD: Number((Math.random() * 100 + 20).toFixed(2)),
  rating: parseFloat((Math.random() * 2 + 3).toFixed(1)),
  href: `/products/demo-${i + 1}`,
  image: DEMO_IMAGE,
}));

function defaultRates(): FxRates {
  return {
    USD: 1,
    EUR: 0.93,
    GBP: 0.79,
    PHP: 58,
    CNY: 7.1,
    JPY: 150,
    NGN: 1600,
    GHS: 15,
    ZAR: 18.5,
    INR: 84,
    BRL: 5.6,
  };
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value || "en-US";
  const currency =
    (cookieStore.get("currency")?.value as SupportedCurrency) ||
    DEFAULT_CURRENCY;
  const rates = defaultRates();

  const blocks = [
    "Featured Products",
    "Best Selling Products",
    "Best Sellers in Beauty & Personal Care",
    "Local Top sellers",
    "Top Sellers",
    "Top Sellers in Dildos for you",
    "Top categories in Vibrator",
    "International Top Sellers in Dolls",
    "Popular Products in Essentials Internationally",
    "International top sellers",
  ];

  return (
    <div className="w-full">
      {/* Keep hero & categories exactly as before */}
      <HeroSlider />
      <CategoriesRow />

      {/* Render your exact section titles */}
      <div className="space-y-6 pb-12">
        {blocks.map((label, idx) => (
          <FeaturedSection
            key={idx}
            title={label}
            items={DEMO_PRODUCTS}
            // currency/i18n props (used by your updated FeaturedSection)
            locale={locale}
            currency={currency}
            rates={rates}
            viewAllHref="/store"
          />
        ))}
      </div>
    </div>
  );
}
