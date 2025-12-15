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

const DEMO_IMAGES = [
  "/attached_assets/stock_images/luxury_adult_product_04d5ddeb.jpg",
  "/attached_assets/stock_images/luxury_adult_product_0363025f.jpg",
  "/attached_assets/stock_images/luxury_adult_product_51dd235d.jpg",
  "/attached_assets/stock_images/luxury_adult_product_68b78495.jpg",
  "/attached_assets/stock_images/luxury_adult_product_f6c14bc7.jpg",
  "/attached_assets/stock_images/luxury_premium_packa_3bc8b8c3.jpg",
  "/attached_assets/stock_images/luxury_premium_packa_ec0efde5.jpg",
  "/attached_assets/stock_images/luxury_gold_black_el_19189da1.jpg",
  "/attached_assets/stock_images/luxury_gold_black_el_974d8dcb.jpg",
  "/attached_assets/stock_images/luxury_black_elegant_401ac9ba.jpg",
  "/attached_assets/stock_images/wellness_massage_lux_22faf4b7.jpg",
  "/attached_assets/stock_images/wellness_massage_lux_ffb40755.jpg",
  "/attached_assets/stock_images/elegant_luxury_welln_4fcd4aed.jpg",
  "/attached_assets/stock_images/elegant_luxury_welln_9df1c862.jpg",
  "/attached_assets/stock_images/luxury_spa_wellness__048f1b75.jpg",
  "/attached_assets/stock_images/luxury_spa_wellness__6e5f722d.jpg",
];

// Demo items use USD as base; FeaturedSection handles conversion/formatting
const DEMO_PRODUCTS = Array.from({ length: 6 }, (_, i) => ({
  id: `product-${i + 1}`,
  title: `Premium Product ${i + 1}`,
  priceUSD: Number((Math.random() * 100 + 20).toFixed(2)),
  rating: parseFloat((Math.random() * 2 + 3).toFixed(1)),
  href: `/products/demo-${i + 1}`,
  image: DEMO_IMAGES[i % DEMO_IMAGES.length],
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
