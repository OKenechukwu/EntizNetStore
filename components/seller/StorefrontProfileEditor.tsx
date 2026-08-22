"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  storeSlug: string;
  initialName: string;
  initialBio: string;
  initialShippingPolicy: string;
  initialReturnPolicy: string;
};

export default function StorefrontProfileEditor({
  storeSlug,
  initialName,
  initialBio,
  initialShippingPolicy,
  initialReturnPolicy,
}: Props) {
  const router = useRouter();
  const [storefrontName, setStorefrontName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [shippingPolicy, setShippingPolicy] = useState(initialShippingPolicy);
  const [returnPolicy, setReturnPolicy] = useState(initialReturnPolicy);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const response = await fetch("/api/seller/storefront", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storefrontName, bio, shippingPolicy, returnPolicy }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to save storefront profile");
      setSaved(true);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save storefront profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6 rounded-2xl border border-white/10 p-5">
      <div>
        <h2 className="text-xl font-semibold">Storefront profile</h2>
        <p className="mt-1 text-sm opacity-65">
          Customer-facing store information. Your public URL remains stable even if the store name changes.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      ) : null}
      {saved ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">Storefront profile saved.</div>
      ) : null}

      <label className="block space-y-2">
        <span className="text-sm font-medium">Store name</span>
        <input
          required
          minLength={2}
          maxLength={100}
          value={storefrontName}
          onChange={(event) => setStorefrontName(event.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-black"
        />
      </label>

      <div className="space-y-2">
        <span className="text-sm font-medium">Public store URL</span>
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm opacity-80">
          /store/{storeSlug}
        </div>
        <p className="text-xs opacity-55">This identifier is stable and cannot be changed from the Seller dashboard.</p>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium">Store bio</span>
        <textarea
          rows={5}
          maxLength={2000}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-black"
          placeholder="Tell shoppers what makes your store distinct."
        />
        <span className="text-xs opacity-55">{bio.length}/2000</span>
      </label>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium">Shipping policy</span>
          <textarea
            rows={8}
            maxLength={5000}
            value={shippingPolicy}
            onChange={(event) => setShippingPolicy(event.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-black"
            placeholder="Processing times, shipping regions, tracking, and delivery expectations."
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium">Return policy</span>
          <textarea
            rows={8}
            maxLength={5000}
            value={returnPolicy}
            onChange={(event) => setReturnPolicy(event.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-black"
            placeholder="Eligibility, return window, condition requirements, exclusions, and refund handling."
          />
        </label>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="luxury-button px-5 py-2 disabled:opacity-50">
          {saving ? "Saving…" : "Save storefront profile"}
        </button>
      </div>
    </form>
  );
}
