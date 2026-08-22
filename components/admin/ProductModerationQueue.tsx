"use client";

import { useCallback, useEffect, useState } from "react";

type PendingProduct = {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  short_description: string | null;
  type: string;
  base_price: number | string;
  compare_at_price: number | string | null;
  submitted_for_review_at: string | null;
  profiles_seller?: {
    storefront_name?: string | null;
    store_slug?: string | null;
    verification_status?: string | null;
  } | null;
  product_media?: Array<{ id: string; url: string; position: number | null }> | null;
  product_variants?: Array<{
    id: string;
    title: string;
    sku: string | null;
    price: number | string;
    inventory_quantity: number | null;
    inventory_policy: string | null;
    is_active: boolean | null;
    position: number | null;
  }> | null;
  product_categories?: Array<{
    category_id: string;
    categories?: { name?: string | null; slug?: string | null } | null;
  }> | null;
};

export default function ProductModerationQueue() {
  const [products, setProducts] = useState<PendingProduct[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/products/pending", { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "Unable to load moderation queue");
      setProducts(Array.isArray(json.products) ? json.products : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load moderation queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(productId: string, status: "approved" | "rejected") {
    const reviewNotes = (notes[productId] || "").trim();
    if (status === "rejected" && !reviewNotes) {
      setError("Add rejection notes before rejecting a product.");
      return;
    }

    setBusy(productId);
    setError("");
    try {
      const response = await fetch("/api/admin/products/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, status, notes: reviewNotes }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "Unable to complete review");
      setProducts((current) => current.filter((product) => product.id !== productId));
      setNotes((current) => {
        const next = { ...current };
        delete next[productId];
        return next;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to complete review");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div className="rounded-xl border p-8 text-center opacity-70">Loading product review queue…</div>;
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {products.length === 0 ? (
        <div className="rounded-xl border p-10 text-center">
          <h2 className="text-lg font-semibold">No products awaiting review</h2>
          <p className="mt-1 text-sm opacity-65">New Seller submissions will appear here.</p>
        </div>
      ) : (
        products.map((product) => {
          const media = [...(product.product_media ?? [])].sort(
            (a, b) => Number(a.position ?? 0) - Number(b.position ?? 0),
          );
          const variants = [...(product.product_variants ?? [])]
            .filter((variant) => variant.is_active !== false)
            .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));
          const categories = (product.product_categories ?? [])
            .map((item) => item.categories?.name)
            .filter(Boolean);

          return (
            <article key={product.id} className="rounded-2xl border p-5 shadow-sm">
              <div className="grid gap-5 lg:grid-cols-[180px_1fr]">
                <div className="aspect-square overflow-hidden rounded-xl border bg-black/5">
                  {media[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={media[0].url} alt={product.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm opacity-50">No image</div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">{product.title}</h2>
                      <p className="text-sm opacity-65">
                        {product.profiles_seller?.storefront_name || product.seller_id} · {product.type}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">${Number(product.base_price).toFixed(2)}</div>
                      {product.compare_at_price != null && (
                        <div className="text-xs line-through opacity-60">
                          ${Number(product.compare_at_price).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm opacity-80">
                    {product.description || product.short_description || "No description supplied."}
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-black/5 p-3 text-sm">
                      <div className="font-medium">Categories</div>
                      <div className="mt-1 opacity-70">{categories.join(", ") || "None"}</div>
                    </div>
                    <div className="rounded-lg bg-black/5 p-3 text-sm">
                      <div className="font-medium">Variants</div>
                      <div className="mt-1 opacity-70">{variants.length}</div>
                    </div>
                    <div className="rounded-lg bg-black/5 p-3 text-sm">
                      <div className="font-medium">Seller verification</div>
                      <div className="mt-1 opacity-70">{product.profiles_seller?.verification_status || "unknown"}</div>
                    </div>
                  </div>

                  {variants.length > 0 && (
                    <div className="mt-4 overflow-x-auto rounded-lg border">
                      <table className="min-w-full text-sm">
                        <thead className="bg-black/5 text-left">
                          <tr>
                            <th className="px-3 py-2">Variant</th>
                            <th className="px-3 py-2">SKU</th>
                            <th className="px-3 py-2">Price</th>
                            <th className="px-3 py-2">Inventory</th>
                          </tr>
                        </thead>
                        <tbody>
                          {variants.map((variant) => (
                            <tr key={variant.id} className="border-t">
                              <td className="px-3 py-2">{variant.title}</td>
                              <td className="px-3 py-2">{variant.sku || "—"}</td>
                              <td className="px-3 py-2">${Number(variant.price).toFixed(2)}</td>
                              <td className="px-3 py-2">{variant.inventory_quantity ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <label className="mt-4 block space-y-2">
                    <span className="text-sm font-medium">Review notes</span>
                    <textarea
                      rows={3}
                      maxLength={5000}
                      value={notes[product.id] || ""}
                      onChange={(event) =>
                        setNotes((current) => ({ ...current, [product.id]: event.target.value }))
                      }
                      placeholder="Optional for approval; required for rejection"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={busy === product.id}
                      onClick={() => void decide(product.id, "approved")}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {busy === product.id ? "Reviewing…" : "Approve & Publish"}
                    </button>
                    <button
                      type="button"
                      disabled={busy === product.id}
                      onClick={() => void decide(product.id, "rejected")}
                      className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
