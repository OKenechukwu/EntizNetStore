// app/search/page.tsx
"use client";

import { useState, useEffect, useRef, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useBrand } from "@/components/BrandProvider";
import Link from "next/link";
import Price from "@/components/ui/Price";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // USD base amount (normalized below)
  image_url?: string;
  slug: string;
  rating?: number;
  reviews_count?: number;
  marketplace_brand?: string;
}

type FxRates = Record<string, number> | null;

function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";

  const { theme, brand } = useBrand();

  const [q, setQ] = useState<string>(initialQuery);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [rates, setRates] = useState<FxRates>(null); // FX rates used by <Price/>

  // Anchor used for smooth scroll into the results area
  const anchorRef = useRef<HTMLDivElement>(null);

  // Fetch FX rates once (client-side)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/currency/rates?base=USD", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load FX rates");
        const json = await res.json(); // { base:"USD", rates:{ USD:1, EUR:0.93, ... } }
        if (mounted) setRates(json?.rates ?? null);
      } catch {
        if (mounted) setRates(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Re-run search whenever (?q=) changes or brand changes
  useEffect(() => {
    const queryFromUrl = searchParams.get("q") || "";
    setQ(queryFromUrl);
    if (queryFromUrl) performSearch(queryFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, brand]);

  // Smoothly scroll to results when they load
  useEffect(() => {
    if (!loading && hasSearched && anchorRef.current) {
      // Slight delay ensures layout is painted before scrolling
      const t = setTimeout(() => {
        anchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
      return () => clearTimeout(t);
    }
  }, [loading, hasSearched, searchResults.length]);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    setHasSearched(true);

    try {
      // Main search via API
      const response = await fetch("/api/search/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, marketplace_brand: brand }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // ✅ Normalize price for main results (base_price preferred)
      const normalized: Product[] = Array.isArray(data.products)
        ? data.products.map((p: any) => ({
            ...p,
            id: p.id,
            name: p.name,
            description: p.description,
            price: Number(p?.base_price ?? p?.price ?? 0),
            slug: p.slug ?? p.id,
            image_url: p.image_url,
            rating: p.rating,
            reviews_count: p.reviews_count,
          }))
        : [];

      setSearchResults(normalized);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    }

    try {
      await Promise.all([
        loadRelatedProducts(searchQuery),
        loadRecommendedProducts(),
      ]);
    } catch (error) {
      console.error("Error loading related/recommended products:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadRelatedProducts = async (searchQuery: string) => {
    try {
      const term = (searchQuery.toLowerCase().split(" ")[0] || "").trim();
      const res = await fetch("/api/search/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: term, marketplace_brand: brand, limit: 8 }),
      });
      const json = await res.json();
      const data = Array.isArray(json.products) ? json.products : null;

      if (data) {
        // ✅ Normalize price for related
        const processed = data.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: Number(p?.base_price ?? p?.price ?? 0),
          slug: p.slug ?? p.id,
          image_url: p.image_url,
        })) as Product[];

        setRelatedProducts((prev) => {
          const unique = processed.filter((p) => !searchResults.some((s) => s.id === p.id));
          return unique;
        });
      }
    } catch (e) {
      console.error("Error loading related products:", e);
    }
  };

  const loadRecommendedProducts = async () => {
    try {
      const res = await fetch("/api/search/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketplace_brand: brand, limit: 6 }),
      });
      const json = await res.json();
      const data = Array.isArray(json.products) ? json.products : null;

    if (data) {
        // ✅ Normalize price for recommended
        const processed = data.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: Number(p?.base_price ?? p?.price ?? 0),
          slug: p.slug ?? p.id,
          image_url: p.image_url,
        })) as Product[];

        setRecommendedProducts((prev) => {
          const unique = processed.filter((p) => !searchResults.some((s) => s.id === p.id));
          return unique;
        });
      }
    } catch (e) {
      console.error("Error loading recommended products:", e);
    }
  };

  // Local ProductCard -> uses <Price amountUSD + rates>
  const ProductCard = ({ product }: { product: Product }) => (
    <Link href={`/products/${product.slug || product.id}`} className="group">
      <div
        className="border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300"
        style={{ borderColor: theme.colors.glass.border }}
      >
        <div className="aspect-square bg-gray-100 relative">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: theme.colors.surface }}
            >
              <span className="text-4xl opacity-50">📦</span>
            </div>
          )}
        </div>

        <div className="p-4">
          <h3
            className="font-semibold text-sm line-clamp-2 mb-2 group-hover:opacity-80 transition-opacity"
            style={{ color: theme.colors.text.primary }}
          >
            {product.name}
          </h3>

          <p
            className="text-xs line-clamp-2 mb-3"
            style={{ color: theme.colors.text.secondary }}
          >
            {product.description}
          </p>

          <div className="flex items-center justify-between">
            <span className="font-bold" style={{ color: theme.colors.accent }}>
              <Price amountUSD={product.price} rates={rates ?? undefined} />
            </span>
            {product.rating && (
              <div className="flex items-center gap-1">
                <span className="text-xs" style={{ color: theme.colors.accent }}>
                  ★
                </span>
                <span className="text-xs" style={{ color: theme.colors.text.secondary }}>
                  {product.rating} ({product.reviews_count || 0})
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );

  // Simple derived texts
  const headerTitle = useMemo(
    () => (q ? "Search Results" : "Search Products"),
    [q]
  );

  // Submit handler for the top search input (updates ?q= without full reload)
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = q.trim();
    const url = next ? `/search?q=${encodeURIComponent(next)}` : `/search`;
    router.push(url);
    if (next) performSearch(next);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.background }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header + top search input */}
        <div className="mb-6">
          <h1
            className="text-2xl md:text-3xl font-bold mb-2"
            style={{ color: theme.colors.text.primary }}
          >
            {headerTitle}
          </h1>

          <form onSubmit={onSubmit} className="flex gap-2 mb-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products…"
              className="flex-1 rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: theme.colors.glass.border, background: "transparent", color: theme.colors.text.primary }}
            />
            <button
              className="rounded-md px-4 py-2 text-sm font-medium"
              style={{ backgroundColor: theme.colors.accent, color: "white" }}
            >
              Search
            </button>
          </form>

          {initialQuery && (
            <p className="text-lg" style={{ color: theme.colors.text.secondary }}>
              {loading
                ? "Searching..."
                : searchResults.length > 0
                ? `Found ${searchResults.length} results for "${initialQuery}"`
                : hasSearched
                ? `No results found for "${initialQuery}"`
                : ""}
            </p>
          )}
        </div>

        {/* Anchor for scroll-to-results */}
        <div ref={anchorRef} />

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="border rounded-lg overflow-hidden animate-pulse"
                style={{ borderColor: theme.colors.glass.border }}
              >
                <div className="aspect-square" style={{ backgroundColor: theme.colors.surface }} />
                <div className="p-4 space-y-2">
                  <div className="h-4 rounded" style={{ backgroundColor: theme.colors.surface }} />
                  <div className="h-3 rounded w-3/4" style={{ backgroundColor: theme.colors.surface }} />
                  <div className="h-4 rounded w-1/2" style={{ backgroundColor: theme.colors.surface }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {searchResults.length > 0 && !loading && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-6" style={{ color: theme.colors.text.primary }}>
              Search Results ({searchResults.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {searchResults.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}

        {/* Related */}
        {relatedProducts.length > 0 && hasSearched && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-6" style={{ color: theme.colors.text.primary }}>
              {searchResults.length === 0 ? "Related Products" : "You Might Also Like"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {relatedProducts.slice(0, 8).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}

        {/* Recommended */}
        {recommendedProducts.length > 0 && hasSearched && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-6" style={{ color: theme.colors.text.primary }}>
              {searchResults.length === 0 ? "Popular Products" : "Recommended Products"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {recommendedProducts.slice(0, 4).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}

        {/* Empty states */}
        {hasSearched && searchResults.length === 0 && relatedProducts.length === 0 && !loading && (
          <div className="text-center py-8">
            <Link
              href="/categories"
              className="inline-block px-6 py-3 rounded-lg font-medium transition-all hover:opacity-90"
              style={{ backgroundColor: theme.colors.accent, color: "white" }}
            >
              Browse Categories
            </Link>
          </div>
        )}

        {!initialQuery && !loading && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
              Start Your Search
            </h2>
            <p className="text-lg mb-6" style={{ color: theme.colors.text.secondary }}>
              Use the search bar above to find products, or browse our categories.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/categories"
                className="px-6 py-3 rounded-lg font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: theme.colors.accent, color: "white" }}
              >
                Browse Categories
              </Link>
              <Link
                href="/store"
                className="px-6 py-3 rounded-lg font-medium border transition-all hover:opacity-80"
                style={{ borderColor: theme.colors.accent, color: theme.colors.accent }}
              >
                View All Products
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full" />
        </div>
      }
    >
      {/* Render local SearchResults WITHOUT props */}
      <SearchResults />
    </Suspense>
  );
}
