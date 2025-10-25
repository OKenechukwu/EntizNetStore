// components/search/SearchResults.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Price from "@/components/ui/Price";
import { useBrand } from "@/components/BrandProvider";

/**
 * ===========================================================
 * SearchResults – Feature-superset, backward-compatible
 * ===========================================================
 *
 * ✅ Works with mixed product shapes:
 *    - title | name
 *    - base_price | price
 *    - image_url | image
 *    - slug | id
 *    - rating, review_count | reviews_count
 *    - compare_at_price (optional)
 *
 * ✅ Currency conversion:
 *    <Price amountUSD={...} rates={rates} />
 *
 * ✅ Optional UX (all safe defaults):
 *    - grid/list toggle
 *    - sorting (price asc/desc, newest, popularity)
 *    - client filtering by min/max price + tags
 *    - result count + query echo
 *    - skeleton loaders
 *    - sale badge & discount %
 *    - brand badge (for primediscreet styling)
 *    - “Load more” button (parent-provided or local)
 *
 * Props you can pass (all optional except `results`):
 *  - results: any[]
 *  - loading?: boolean
 *  - query?: string
 *  - totalResults?: number
 *  - rates?: Record<string, number> | null
 *  - hasMore?: boolean                 // if infinite paging upstream
 *  - onLoadMore?: () => Promise<void>  // trigger upstream fetch
 *  - initialView?: "grid" | "list"
 *  - enableFacets?: boolean
 *  - enableSort?: boolean
 *  - enableLocalPaging?: boolean       // paginate locally if no onLoadMore
 *  - pageSize?: number                 // local page size (default 24)
 */

type FxRates = Record<string, number> | null;

type SearchResultsProps = {
  results: any[];
  loading?: boolean;
  query?: string;
  totalResults?: number;
  rates?: FxRates;
  hasMore?: boolean;
  onLoadMore?: () => Promise<void>;
  initialView?: "grid" | "list";
  enableFacets?: boolean;
  enableSort?: boolean;
  enableLocalPaging?: boolean;
  pageSize?: number;
};

/* ------------------------------ Pickers ------------------------------ */
const pickTitle = (p: any) => p?.title ?? p?.name ?? "Untitled";
const pickImage = (p: any) => p?.image_url ?? p?.image ?? null;
const pickSlug = (p: any) => p?.slug ?? p?.id ?? "";
const pickSeller = (p: any) =>
  p?.seller?.storefront_name ?? p?.storefront_name ?? p?.brand ?? null;
const pickPrice = (p: any) =>
  typeof p?.base_price === "number"
    ? p.base_price
    : typeof p?.price === "number"
      ? p.price
      : Number(p?.price ?? NaN);
const pickCompare = (p: any) =>
  typeof p?.compare_at_price === "number" ? p.compare_at_price : undefined;
const pickRating = (p: any) =>
  typeof p?.rating === "number"
    ? p.rating
    : typeof p?.stars === "number"
      ? p.stars
      : 0;
const pickReviews = (p: any) =>
  typeof p?.review_count === "number"
    ? p.review_count
    : typeof p?.reviews_count === "number"
      ? p.reviews_count
      : 0;
const pickTags = (p: any) => p?.tags ?? [];
const pickOnSale = (p: any) =>
  !!p?.on_sale || (typeof pickCompare(p) === "number" && pickCompare(p)! > pickPrice(p));

/* ------------------------------ Helpers ------------------------------ */
function discountPercent(price: number, compare?: number) {
  if (typeof compare !== "number" || compare <= price || price <= 0) return null;
  const pct = Math.round(((compare - price) / compare) * 100);
  return pct > 0 ? pct : null;
}

const SORTS = [
  { key: "relevance", label: "Relevance" },
  { key: "price_asc", label: "Price: Low to High" },
  { key: "price_desc", label: "Price: High to Low" },
  { key: "newest", label: "Newest" },
  { key: "popular", label: "Most Popular" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

/* ------------------------------ Component ------------------------------ */
export default function SearchResults({
  results,
  loading = false,
  query = "",
  totalResults = 0,
  rates = null,
  hasMore = false,
  onLoadMore,
  initialView = "grid",
  enableFacets = true,
  enableSort = true,
  enableLocalPaging = false,
  pageSize = 24,
}: SearchResultsProps) {
  const { brand, theme } = useBrand();

  /* --------------------------- View state --------------------------- */
  const [view, setView] = useState<"grid" | "list">(initialView);
  const [sort, setSort] = useState<SortKey>("relevance");

  // Facets (all optional; harmless defaults)
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [tagQuery, setTagQuery] = useState<string>("");
  const [onlyOnSale, setOnlyOnSale] = useState<boolean>(false);

  // Local pagination (if not using upstream onLoadMore)
  const [localPage, setLocalPage] = useState<number>(1);
  const localHasMoreRef = useRef<boolean>(false);

  useEffect(() => {
    // Reset local page when new results arrive
    setLocalPage(1);
  }, [results, query]);

  /* ------------------------- Derived lists ------------------------- */
  const filtered = useMemo(() => {
    let list = results ?? [];

    // Tag filter (simple contains)
    if (tagQuery.trim()) {
      const q = tagQuery.trim().toLowerCase();
      list = list.filter((p) => (pickTags(p) as string[]).some((t) => String(t).toLowerCase().includes(q)));
    }

    // On-sale filter
    if (onlyOnSale) {
      list = list.filter((p) => pickOnSale(p));
    }

    // Price range (applies on USD base numbers)
    const min = Number(minPrice);
    const max = Number(maxPrice);
    list = list.filter((p) => {
      const price = pickPrice(p);
      if (Number.isFinite(min) && minPrice !== "" && price < min) return false;
      if (Number.isFinite(max) && maxPrice !== "" && price > max) return false;
      return true;
    });

    // Sorting
    list = [...list];
    switch (sort) {
      case "price_asc":
        list.sort((a, b) => pickPrice(a) - pickPrice(b));
        break;
      case "price_desc":
        list.sort((a, b) => pickPrice(b) - pickPrice(a));
        break;
      case "popular":
        list.sort((a, b) => pickReviews(b) - pickReviews(a));
        break;
      case "newest":
        // If you have created_at: string on items, prefer that; else fallback keeps stable order
        list.sort((a, b) => {
          const da = Date.parse(a?.created_at ?? "") || 0;
          const db = Date.parse(b?.created_at ?? "") || 0;
          return db - da;
        });
        break;
      case "relevance":
      default:
        // Keep upstream order (assumed relevance)
        break;
    }

    return list;
  }, [results, tagQuery, onlyOnSale, minPrice, maxPrice, sort]);

  const locallyPaged = useMemo(() => {
    if (!enableLocalPaging || onLoadMore) return filtered;
    const end = localPage * pageSize;
    const slice = filtered.slice(0, end);
    localHasMoreRef.current = end < filtered.length;
    return slice;
  }, [filtered, enableLocalPaging, onLoadMore, localPage, pageSize]);

  const showHasMore = onLoadMore ? hasMore : enableLocalPaging ? localHasMoreRef.current : false;

  /* -------------------------- Subcomponents ------------------------- */
  const StarRating = ({ rating, reviewCount }: { rating: number; reviewCount: number }) => (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className="text-sm"
            style={{ color: i <= rating ? theme.colors.accent : theme.colors.text.secondary }}
          >
            ★
          </span>
        ))}
      </div>
      <span className="text-xs" style={{ color: theme.colors.text.secondary }}>
        ({reviewCount})
      </span>
    </div>
  );

  const ProductCard = ({ p }: { p: any }) => {
    const title = pickTitle(p);
    const img = pickImage(p);
    const slug = pickSlug(p);
    const price = pickPrice(p);
    const compare = pickCompare(p);
    const onSale = pickOnSale(p);
    const pct = discountPercent(price, compare);
    const rating = pickRating(p);
    const reviews = pickReviews(p);
    const seller = pickSeller(p);
    const tags = pickTags(p) as string[];

    return (
      <Link href={`/products/${slug}`} prefetch className="group">
        <div
          className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
          style={{ borderColor: theme.colors.glass.border }}
        >
          {/* Media */}
          <div className="relative aspect-square overflow-hidden bg-black/10">
            {img ? (
              <img
                src={img}
                alt={title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: theme.colors.background }}>
                <span className="text-4xl" style={{ color: theme.colors.text.secondary }}>
                  🎁
                </span>
              </div>
            )}

            {/* Sale badge */}
            {onSale && (
              <div className="absolute left-2 top-2 rounded px-2 py-1 text-xs font-bold text-white" style={{ backgroundColor: "#e11d48" }}>
                SALE{typeof pct === "number" ? ` • -${pct}%` : ""}
              </div>
            )}

            {/* Brand badge (example styling for primediscreet) */}
            {brand === "primediscreet" && (
              <div
                className="absolute right-2 top-2 rounded px-2 py-1 text-xs font-bold"
                style={{ backgroundColor: theme.colors.accent, color: theme.colors.background }}
              >
                ELITE
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-3 p-4">
            <div>
              <h3 className="line-clamp-2 font-semibold" style={{ color: theme.colors.text.primary }}>
                {title}
              </h3>
              {seller && (
                <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
                  by {seller}
                </p>
              )}
            </div>

            {rating > 0 && <StarRating rating={rating} reviewCount={reviews} />}

            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold" style={{ color: theme.colors.accent }}>
                <Price amountUSD={Number(price)} rates={rates ?? undefined} />
              </span>
              {typeof compare === "number" && compare > price && (
                <span className="text-sm line-through" style={{ color: theme.colors.text.secondary }}>
                  <Price amountUSD={Number(compare)} rates={rates ?? undefined} />
                </span>
              )}
            </div>

            {tags?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.slice(0, 3).map((t, i) => (
                  <span
                    key={`${t}-${i}`}
                    className="rounded px-2 py-0.5 text-xs"
                    style={{ backgroundColor: theme.colors.background, color: theme.colors.text.secondary }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  };

  const ProductRow = ({ p }: { p: any }) => {
    const title = pickTitle(p);
    const img = pickImage(p);
    const slug = pickSlug(p);
    const price = pickPrice(p);
    const compare = pickCompare(p);
    const onSale = pickOnSale(p);
    const pct = discountPercent(price, compare);
    const rating = pickRating(p);
    const reviews = pickReviews(p);
    const seller = pickSeller(p);
    const tags = pickTags(p) as string[];

    return (
      <Link href={`/products/${slug}`} prefetch>
        <div
          className="flex gap-4 rounded-lg border p-4 transition-shadow hover:shadow-md"
          style={{ borderColor: theme.colors.glass.border }}
        >
          <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded bg-black/10">
            {img ? (
              <img src={img} alt={title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-2xl" style={{ color: theme.colors.text.secondary }}>
                  🎁
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold" style={{ color: theme.colors.text.primary }}>
                  {title}
                </h3>
                {seller && (
                  <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
                    by {seller}
                  </p>
                )}
                {rating > 0 && <StarRating rating={rating} reviewCount={reviews} />}
              </div>

              <div className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-lg font-semibold" style={{ color: theme.colors.accent }}>
                    <Price amountUSD={Number(price)} rates={rates ?? undefined} />
                  </span>
                  {typeof compare === "number" && compare > price && (
                    <span className="text-sm line-through" style={{ color: theme.colors.text.secondary }}>
                      <Price amountUSD={Number(compare)} rates={rates ?? undefined} />
                    </span>
                  )}
                </div>
                {onSale && typeof pct === "number" && (
                  <div className="text-xs font-medium" style={{ color: "#e11d48" }}>
                    -{pct}% OFF
                  </div>
                )}
              </div>
            </div>

            {tags?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.slice(0, 6).map((t, i) => (
                  <span
                    key={`${t}-${i}`}
                    className="rounded px-2 py-0.5 text-xs"
                    style={{ backgroundColor: theme.colors.background, color: theme.colors.text.secondary }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  };

  /* ----------------------------- UI Blocks ---------------------------- */
  const Toolbar = () => {
    const count = totalResults > 0 ? totalResults : filtered.length;

    return (
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
            {count} {count === 1 ? "Product" : "Products"}
            {query && (
              <span className="ml-1" style={{ color: theme.colors.text.secondary }}>
                for “{query}”
              </span>
            )}
          </h2>
          {brand === "primediscreet" && (
            <p className="text-sm" style={{ color: theme.colors.accent }}>
              Elite curated collection
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <button
            onClick={() => setView("grid")}
            className={`rounded px-3 py-2 text-sm transition-colors ${view === "grid" ? "text-white" : ""}`}
            style={{
              backgroundColor: view === "grid" ? theme.colors.accent : "transparent",
              color: view === "grid" ? (brand === "primediscreet" ? theme.colors.background : "white") : theme.colors.text.secondary,
              border: `1px solid ${theme.colors.glass.border}`,
            }}
            aria-label="Grid view"
          >
            ⊞
          </button>
          <button
            onClick={() => setView("list")}
            className={`rounded px-3 py-2 text-sm transition-colors ${view === "list" ? "text-white" : ""}`}
            style={{
              backgroundColor: view === "list" ? theme.colors.accent : "transparent",
              color: view === "list" ? (brand === "primediscreet" ? theme.colors.background : "white") : theme.colors.text.secondary,
              border: `1px solid ${theme.colors.glass.border}`,
            }}
            aria-label="List view"
          >
            ☰
          </button>

          {/* Sort */}
          {enableSort && (
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded border bg-transparent px-2 py-2 text-sm"
              style={{ borderColor: theme.colors.glass.border, color: theme.colors.text.primary }}
              aria-label="Sort results"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key} className="bg-black text-white">
                  {s.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    );
  };

  const Facets = () => {
    if (!enableFacets) return null;
    return (
      <div
        className="mb-6 grid grid-cols-1 gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4"
        style={{ borderColor: theme.colors.glass.border }}
      >
        <div className="flex flex-col">
          <label className="mb-1 text-xs" style={{ color: theme.colors.text.secondary }}>
            Min Price (USD)
          </label>
          <input
            inputMode="decimal"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="0"
            className="rounded border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor: theme.colors.glass.border, color: theme.colors.text.primary }}
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-1 text-xs" style={{ color: theme.colors.text.secondary }}>
            Max Price (USD)
          </label>
          <input
            inputMode="decimal"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="9999"
            className="rounded border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor: theme.colors.glass.border, color: theme.colors.text.primary }}
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-1 text-xs" style={{ color: theme.colors.text.secondary }}>
            Tag contains
          </label>
          <input
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            placeholder="e.g. waterproof"
            className="rounded border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor: theme.colors.glass.border, color: theme.colors.text.primary }}
          />
        </div>
        <div className="flex items-end">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm" style={{ color: theme.colors.text.primary }}>
            <input
              type="checkbox"
              checked={onlyOnSale}
              onChange={(e) => setOnlyOnSale(e.target.checked)}
              className="h-4 w-4 accent-current"
            />
            On sale only
          </label>
        </div>
      </div>
    );
  };

  /* ------------------------------ Render ------------------------------ */
  if (loading) {
    return (
      <div className="space-y-6">
        <Toolbar />
        <Facets />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-full overflow-hidden rounded-lg border"
              style={{ borderColor: theme.colors.glass.border }}
            >
              <div className="aspect-square animate-pulse" style={{ background: theme.colors.surface }} />
              <div className="space-y-3 p-4">
                <div className="h-4 w-2/3 animate-pulse rounded" style={{ background: theme.colors.surface }} />
                <div className="h-3 w-1/3 animate-pulse rounded" style={{ background: theme.colors.surface }} />
                <div className="h-6 w-1/2 animate-pulse rounded" style={{ background: theme.colors.surface }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="space-y-6">
        <Toolbar />
        <Facets />
        <div className="py-16 text-center">
          <div className="mb-3 text-5xl">🔍</div>
          <h3 className="mb-1 text-xl font-semibold" style={{ color: theme.colors.text.primary }}>
            No results found
          </h3>
          <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
            Try different keywords, remove filters, or browse categories.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toolbar />
      <Facets />

      {view === "grid" ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {locallyPaged.map((p) => (
            <ProductCard key={pickSlug(p)} p={p} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {locallyPaged.map((p) => (
            <ProductRow key={pickSlug(p)} p={p} />
          ))}
        </div>
      )}

      {(showHasMore || (enableLocalPaging && filtered.length > locallyPaged.length)) && (
        <div className="pt-6 text-center">
          <button
            onClick={async () => {
              if (onLoadMore) {
                await onLoadMore();
              } else if (enableLocalPaging) {
                setLocalPage((n) => n + 1);
              }
            }}
            className="rounded-lg border px-6 py-3 font-medium transition-all hover:shadow-md"
            style={{ borderColor: theme.colors.glass.border, color: theme.colors.text.primary }}
          >
            Load More Results
          </button>
        </div>
      )}
    </div>
  );
}
