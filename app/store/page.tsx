"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { T, useI18n } from "@/components/i18n/I18nProvider";
import I18nText from "@/components/i18n/I18nText";

import CategoriesRow from "@/components/home/CategoriesRow";
import { CATEGORIES } from "@/data/categories";

import {
  getFxRates,
  convertFromBase,
  formatPrice,
  type SupportedCurrency,
  type FxRates,
} from "@/lib/currency";

const grad =
  "bg-[linear-gradient(135deg,var(--brand-primary,#5B0060),var(--brand-secondary,#D1B000))]";
const cardBase =
  "overflow-hidden rounded-[14px] border border-white/10 bg-[var(--surface,rgba(255,255,255,0.04))] backdrop-blur transition hover:bg-white/[0.08]";
const titleH3 = "mb-4 text-[20px] md:text-[22px] font-extrabold";

function CategoryQuickRow() {
  const { locale } = useI18n();
  return (
    <section className="w-full px-4 md:px-8 lg:px-12 -mt-2 md:-mt-3">
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
            aria-label={c.name}
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
                {c.count ?? 0} <T k="common.items" fallback="items" />
              </div>
            </div>
            <div className="p-3">
              <div className="line-clamp-1 text-[13.5px] font-bold">
                <I18nText text={c.name} />
              </div>
              {c.desc && (
                <div className="line-clamp-2 text-[12.5px] opacity-80">
                  <I18nText text={c.desc} />
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {Array.isArray(CATEGORIES?.[0]?.sub) && CATEGORIES[0].sub.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Quick filters">
          {CATEGORIES[0].sub.map((s: any) => (
            <button
              key={s.name ?? s.slug}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/30"
              type="button"
            >
              <I18nText text={s.name ?? s.title} />
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

type Item = {
  id: string;
  title: string;
  img: string;
  priceUSD: number;
};

function ProductGrid({
  title,
  items,
  rates,
}: {
  title: string;
  items: Item[];
  rates: FxRates | null;
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
          const converted = rates
            ? convertFromBase(p.priceUSD, currency as SupportedCurrency, rates)
            : null;
          const displayPrice = converted !== null
            ? formatPrice(converted, currency as SupportedCurrency, locale)
            : "";

          return (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
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
                  <I18nText text={p.title} />
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

export default function StoreHome() {
  const { t } = useI18n();

  // Live products from the marketplace database (via server API)
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/search/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketplace_brand: "", limit: 40 }),
        });
        const json = await res.json();
        if (mounted && Array.isArray(json.products)) {
          setItems(
            json.products.map((p: any) => ({
              id: p.slug ?? p.id,
              title: p.title ?? p.name,
              img: p.image_url,
              priceUSD: Number(p.base_price ?? 0),
            })),
          );
        }
      } catch (e) {
        console.error("Failed to load live products:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const featured = useMemo(() => items.slice(0, 10), [items]);
  const best = useMemo(() => items.slice(0, 10), [items]);
  const top = useMemo(() => [...items].sort((a, b) => b.priceUSD - a.priceUSD).slice(0, 10), [items]);
  const near = useMemo(() => [...items].reverse().slice(0, 10), [items]);

  const [rates, setRates] = useState<FxRates | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await getFxRates();
        if (mounted) setRates(r);
      } catch {
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen w-full bg-background text-foreground">
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

      <CategoriesRow />

      <CategoryQuickRow />
      <FeaturedBrands />

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
