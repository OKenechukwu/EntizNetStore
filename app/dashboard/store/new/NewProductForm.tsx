// app/dashboard/store/new/NewProductForm.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { convertToBase } from "@/lib/currency";

function readCookie(name: string) {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function NewProductForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // price typed IN user's selected currency
  const [price, setPrice] = useState<string>("");
  const [userCurrency, setUserCurrency] = useState<string>("USD");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const pref = (readCookie("currency") || "USD").toUpperCase();
    setUserCurrency(pref);
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    const typed = Number(price);
    if (!title.trim()) return setErr("Title is required.");
    if (!Number.isFinite(typed) || typed <= 0) {
      return setErr("Price must be a positive number.");
    }

    try {
      setLoading(true);

      // Ensure signed in
      const { data: u, error: userErr } = await supabase.auth.getUser();
      if (userErr || !u.user) {
        return router.replace("/auth/sign-in");
      }
      const owner = u.user.id;

      // Get FX (base -> target) and convert typed (user currency) -> base for storage
      const fx = await fetch("/api/fx")
        .then((r) => r.json())
        .catch(() => ({ rates: {} }));
      const rates: Record<string, number> = fx.rates || {};
      const priceBase = convertToBase(typed, userCurrency, rates);

      // Insert row in BASE currency
      const { error } = await supabase.from("products").insert({
        title: title.trim(),
        description: description.trim(),
        price: priceBase,
        images: [],
        owner,
      });

      if (error) throw error;

      router.replace("/dashboard/store");
    } catch (e: any) {
      setErr(e.message ?? "Failed to create product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">New Product</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          className="w-full border rounded px-3 py-2"
          placeholder="Description (optional)"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div>
          <input
            className="w-full border rounded px-3 py-2"
            type="number"
            min="0"
            step="0.01"
            placeholder={`Price in ${userCurrency}`}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">Price in {userCurrency}</p>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <button
          className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
          disabled={loading}
          type="submit"
        >
          {loading ? "Creating…" : "Create"}
        </button>
      </form>
    </div>
  );
}
