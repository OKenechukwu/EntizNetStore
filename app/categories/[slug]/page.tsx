// app/store/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { T, useI18n } from "@/components/i18n/I18nProvider";

import CategoriesRow from "@/components/home/CategoriesRow";
import { CATEGORIES } from "@/data/categories";

import {
  getFxRates,
  convertAndFormatFromBase,
  type SupportedCurrency,
} from "@/lib/currency";

/* -------------------------------------------
   Royal Desire helpers (semantic + surface)
-------------------------------------------- */
const grad =
  "bg-[linear-gradient(135deg,var(--brand-primary,#5B0060),var(--brand-secondary,#D1B000))]";
const cardBase =
  "overflow-hidden rounded-[14px] border border-white/10 bg-[var(--surface,rgba(255,255,255,0.04))] backdrop-blur transition hover:bg-white/[0.08]";
const titleH3 = "mb-4 text-[20px] md:text-[22px] font-extrabold";

/* -------------------------------------------
   Inline components
-------------------------------------------- */
function CategoryQuickRow() {
  return (
    <section className="w-full px-4 md:px-8 lg:px-12 -mt-2 md:-mt-3">
      {/* 6 visible categories above the fold (full width, responsive) */}
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        aria-label="Top categories"
        role="list"
      >
        {CATEGORIES.slice(0, 6).map((c: any) => (
          <Link
            key={c.key ?? c.slug ?? c.name}
            href={`/categories/${c.key ?? c.slug}`}
            className={cardBase}
            aria-label={`${c.name}${c.desc ? ` — ${c.desc}` : ""}`}
            role="listitem"
          >
            <div className="relative aspect-[16/10]">
              <Image
                src={c.image}
                alt={c.name}
                fill
                sizes="(max-width: 1024px) 50vw, 16vw"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/60" />
              <div className="absolute bottom-1 left-1 right-1 text-[11px] opacity-85">
                {c.count ?? 0} items
              </div>
            </div>
            <div className="p-3">
              <div className="line-clamp-1 text-[13.5px] font-bold">
                {c.name}
              </div>
              {c.desc && (
                <div className="line-clamp-2 text-[12.5px] opacity-80">
                  {c.desc}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Quick subcategory chips */}
      {Array.isArray(CATEGORIES?.[0]?.sub) && CATEGORIES[0].sub.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Quick filters">
          {CATEGORIES[0].sub.map((s: any) => (
            <button
              key={s.name ?? s.slug}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/30"
              type="button"
            >
              {s.name ?? s.title}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function FeaturedBrands() {
  const { t } = useI18n();
  const brands = ["LUMINA", "AURAE", "VELVET", "NOVA", "CRESCEN", "SIREN"];
  return (
    <section className="w-full px-4 md:px-8 lg:px-12 py-6">
      <h3 className={titleH3}>
        {t("home.featuredBrands") ?? "Featured Brands"}
      </h3>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6" role="list">
        {brands.map((b, i) => (
          <div
            key={i}
            className={`flex items-center justify-center ${cardBase} px-3 py-6 text-sm font-extrabold tracking-wide opacity-90`}
            role="listitem"
            aria-label={`Brand ${b}`}
          >
            {b}
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------
   Product item type (store prices in USD, number)
-------------------------------------------- */
type Item = {
  id: string;
  title: string;
  img: string;
  priceUSD: number; // ✅ numeric USD base
};

function ProductGrid({
  title,
  items,
  rates,
}: {
  title: string;
  items: Item[];
  rates: Record<string, number> | null;
}) {
  const { t, locale, currency } = useI18n();

  return (
    <section className="w-full px-4 md:px-8 lg:px-12 py-6" aria-label={title}>
      <h3 className={titleH3}>{title}</h3>
      <div
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        role="list"
      >
        {items.map((p) => {
          const displayPrice = rates
            ? convertAndFormatFromBase(
                p.priceUSD,
                currency as SupportedCurrency,
                locale,
                rates,
              )
            : ""; // avoid flicker until rates load

          return (
            <Link
              key={p.id}
              href={`/p/${p.id}`}
              className={cardBase}
              role="listitem"
            >
              <div className="relative aspect-[4/3]">
                <Image
                  src={p.img}
                  alt={p.title}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 18vw"
                  className="object-cover"
                />
              </div>
              <div className="p-3">
                <div className="line-clamp-2 text-[13.5px] font-bold">
                  {p.title}
                </div>
                <div
                  className={`${grad} bg-clip-text font-extrabold text-transparent`}
                >
                  {displayPrice || t("loading") || "…"}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* -------------------------------------------
   Demo data (now numeric USD, NOT strings)
-------------------------------------------- */
const demo = (prefix: string, n: number): Item[] =>
  Array.from({ length: n }).map((_, i) => ({
    id: `${prefix}-${i}`,
    title: `Lumina Velvet Oil ${100 + i}ml`,
    img: `/demo/products/p${(i % 6) + 1}.jpg`,
    priceUSD: 19 + i, // ✅ base in USD as number
  }));

/* -------------------------------------------
   Main Page
-------------------------------------------- */
export default function StoreHome() {
  const { t } = useI18n();

  const featured = useMemo(() => demo("feat", 10), []);
  const best = useMemo(() => demo("best", 10), []);
  const top = useMemo(() => demo("top", 10), []);
  const near = useMemo(() => demo("near", 10), []);

  // Fetch FX rates on mount (client page)
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await getFxRates("USD");
        if (mounted) setRates(r);
      } catch {
        // leave null; UI shows loading ellipsis
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen w-full bg-background text-foreground">
      {/* Hero (dark + gradient) */}
      <section className="relative mx-auto w-full max-w-screen-2xl px-4 pt-6">
        <div className="relative overflow-hidden rounded-2xl border border-white/10">
          <div className="aspect-[16/6] w-full bg-[linear-gradient(135deg,rgba(120,0,200,0.6),rgba(209,176,0,0.45))]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/60" />
          <div className="absolute inset-x-0 bottom-0 p-6">
            <h1 className="text-2xl font-extrabold">
              <T k="home.welcome" />
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/80">
              <T k="home.heroSubtitle" />
            </p>
          </div>
        </div>
      </section>

      {/* Category Section (12 visible + Show more to 17) */}
      <CategoriesRow />

      {/* Quick & Brand Rows */}
      <CategoryQuickRow />
      <FeaturedBrands />

      {/* Product Sections */}
      <ProductGrid
        title={t("home.featuredProducts")}
        items={featured}
        rates={rates}
      />
      <ProductGrid
        title={t("home.bestSellingProducts")}
        items={best}
        rates={rates}
      />
      <ProductGrid
        title={t("home.topSellers") ?? "Top Sellers"}
        items={top}
        rates={rates}
      />
      <ProductGrid
        title={t("home.fromNearbySellers") ?? "From Nearby Sellers"}
        items={near}
        rates={rates}
      />

      {/* Footer */}
      <footer className="mt-16 w-full bg-[var(--brand-primary,#5B0060)] py-10 text-white">
        <div className="px-4 text-center md:px-8 lg:px-12">
          <p className="text-sm opacity-70">
            © {new Date().getFullYear()} EntizNetStore —{" "}
            <T k="footer.copyright" />
          </p>
        </div>
      </footer>
    </main>
  );
}
