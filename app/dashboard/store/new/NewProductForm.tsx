"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_CURRENCY } from "@/lib/currency";

type FxRates = Record<string, number>;

function readCurrencyCookie(): string {
  const c =
    typeof document !== "undefined"
      ? document.cookie
          .split("; ")
          .find((r) => r.startsWith("currency="))
          ?.split("=")[1]
      : undefined;
  return (c ?? DEFAULT_CURRENCY).toUpperCase();
}

// Convert an amount in user's currency to USD (our base)
function toUSD(amount: number, currency: string, rates: FxRates): number {
  if (!amount || !Number.isFinite(amount)) return 0;
  const rate = rates?.[currency.toUpperCase()];
  if (!rate || rate <= 0) return amount; // fallback: assume already USD
  return Math.round((amount / rate) * 100) / 100;
}

export default function NewProductForm() {
  const router = useRouter();

  // Build a Supabase client directly (avoids local helper export mismatch)
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createSupabaseClient(url, anon);
  }, []);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceDisplay, setPriceDisplay] = useState<string>("");
  const [imageUrl, setImageUrl] = useState("");
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [rates, setRates] = useState<FxRates>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrency(readCurrencyCookie());
    (async () => {
      try {
        const res = await fetch("/api/fx");
        if (res.ok) {
          const data = await res.json();
          setRates(data.rates ?? {});
        }
      } catch (e) {
        console.error("FX load failed:", e);
      }
    })();
  }, []);

  const priceUSD = useMemo(() => {
    const val = Number(priceDisplay);
    if (!Number.isFinite(val)) return 0;
    return toUSD(val, currency, rates);
  }, [priceDisplay, currency, rates]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const val = Number(priceDisplay);
    if (!title.trim()) return setError("Title is required.");
    if (!Number.isFinite(val) || val <= 0)
      return setError("Enter a valid price.");
    setSubmitting(true);

    try {
      const { data: au, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const userId = au.user?.id;
      if (!userId) {
        setError("You must be signed in to create a product.");
        setSubmitting(false);
        return;
      }

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        price: priceUSD, // USD in DB
        images: imageUrl ? [imageUrl.trim()] : [],
        provider_id: userId, // RLS
      };

      const { error: insertErr } = await supabase
        .from("products")
        .insert(payload);
      if (insertErr) throw insertErr;

      router.push("/dashboard/store");
      router.refresh();
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to create product.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium">Title</label>
        <input
          type="text"
          className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Aroma Candle"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Description</label>
        <textarea
          className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Write a short description…"
          rows={4}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Price ({currency})
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
            value={priceDisplay}
            onChange={(e) => setPriceDisplay(e.target.value)}
            placeholder="e.g. 19.99"
            required
          />
          <p className="text-xs text-gray-500">
            Will be saved as <span className="font-medium">USD</span>: $
            {priceUSD.toFixed(2)}
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Image URL (optional)
          </label>
          <input
            type="url"
            className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…/image.jpg"
          />
          <p className="text-xs text-gray-500">
            Stored as the first item in <code>images[]</code>.
          </p>
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center rounded-lg bg-black px-4 py-2 text-white disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Create Product"}
        </button>
      </div>
    </form>
  );
}
