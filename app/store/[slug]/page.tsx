// app/store/[slug]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import I18nText from "@/components/i18n/I18nText";

// --- Types ---
type SellerRow = {
  id: string;
  storefront_name: string | null;
  bio: string | null;
  logo_url: string | null;
  banner_url: string | null;
  store_slug: string | null;
};

type Product = {
  id: string;
  slug?: string | null;
  title: string;
  price: number;
  image_url: string | null;
  status?: string | null;
  created_at?: string;
};

// --- Helpers ---
function currency(n: number | null | undefined) {
  if (typeof n !== "number") return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default function PublicStorefrontPage() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearchParams();
  const router = useRouter();

  const page = Math.max(1, parseInt(search.get("page") || "1", 10));
  const q = (search.get("q") || "").trim();

  const [seller, setSeller] = useState<SellerRow | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const pageSize = 24;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Load seller by slug (preferred) or by id (fallback)
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        // Fetch seller + products from the live database via server API
        const params = new URLSearchParams({ page: String(page) });
        if (q) params.set("q", q);
        const res = await fetch(
          `/api/storefront/${encodeURIComponent(String(slug))}?${params.toString()}`,
          { cache: "no-store" },
        );

        if (cancelled) return;

        if (!res.ok) {
          router.replace("/store"); // seller not found → back to marketplace
          return;
        }

        const json = await res.json();
        setSeller(json.seller ?? null);
        setCount(Number(json.count ?? 0));
        setProducts(Array.isArray(json.products) ? json.products : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, page, q]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(count / pageSize)),
    [count],
  );

  const updateQuery = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(search.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null) params.delete(k);
      else params.set(k, v);
    });
    router.replace(`/store/${slug}?${params.toString()}`);
  };

  const doSearch = (term: string) => {
    updateQuery({ q: term || null, page: "1" });
  };

  const goPage = (p: number) => {
    updateQuery({ page: String(p) });
  };

  // Simple Add-to-Cart (stub) – replace with your real cart action
  const addToCart = async (product: Product) => {
    try {
      const key = "cart";
      const data = JSON.parse(localStorage.getItem(key) || "[]");
      data.push({ productId: product.id, qty: 1 });
      localStorage.setItem(key, JSON.stringify(data));
      alert("Added to cart");
    } catch (e) {
      console.error(e);
      alert("Failed to add to cart.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="opacity-80">Loading store…</p>
        </div>
      </div>
    );
  }

  if (!seller) return null;

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="space-y-8">
      {/* Banner / Header */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-white/10">
        <div className="relative h-44 sm:h-56 md:h-64">
          {seller.banner_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={seller.banner_url}
              alt={`${seller.storefront_name || "Store"} banner`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-pink-500/30 to-purple-600/30" />
          )}
        </div>

        <div className="p-4 sm:p-6 md:p-8">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-full overflow-hidden border border-white/20">
              {seller.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={seller.logo_url}
                  alt="Logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-white/10" />
              )}
            </div>
            <div className="flex-1">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-accent-gold">
                {seller.storefront_name || "Store"}
              </h1>
              {seller.bio && (
                <p className="opacity-80 text-sm mt-1">{seller.bio}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    alert("Store link copied!");
                  }}
                  className="luxury-button-outline px-3 py-1 text-sm"
                >
                  Copy Store Link
                </button>
                <Link
                  href="/store"
                  className="luxury-button-outline px-3 py-1 text-sm"
                >
                  Back to EntizNet Store
                </Link>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="mt-6">
            <div className="flex gap-2">
              <input
                defaultValue={q}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const term = (e.target as HTMLInputElement).value;
                    doSearch(term);
                  }
                }}
                placeholder="Search products in this store…"
                className="flex-1 px-4 py-2 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none"
              />
              <button
                onClick={() => {
                  const term =
                    (document.activeElement as HTMLInputElement)?.value || q;
                  doSearch(term);
                }}
                className="luxury-button px-4 py-2"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.length === 0 ? (
          <div className="col-span-full text-center opacity-60 py-16">
            No products found.
          </div>
        ) : (
          products.map((p) => (
            <div key={p.id} className="glass-card p-3 flex flex-col">
              <div className="aspect-square rounded-lg overflow-hidden bg-white/5 border border-white/10 mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image_url || "/images/placeholder.jpg"}
                  alt={p.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h3 className="font-medium line-clamp-2 mb-1"><I18nText text={p.title} /></h3>
                <p className="text-accent-gold font-semibold">
                  {currency(p.price)}
                </p>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => addToCart(p)}
                  className="luxury-button flex-1 py-2"
                >
                  Add to Cart
                </button>
                <Link
                  href={`/products/${p.slug || p.id}`}
                  className="luxury-button-outline py-2 px-3"
                >
                  View
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button
            className="luxury-button-outline px-3 py-2 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => goPage(page - 1)}
          >
            Prev
          </button>
          <span className="opacity-80 text-sm">
            Page {page} of {totalPages}
          </span>
          <button
            className="luxury-button-outline px-3 py-2 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => goPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
