"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { upsertVendorProfile } from "./actions";

export default function VendorProfilePage() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [storefront_name, setStorefrontName] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [min_order_budget, setBudget] = useState<number | undefined>();
  const [interests, setInterests] = useState("");

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return setLoading(false);
      const { data } = await supabase
        .from("vendor_profile")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setStorefrontName(data.storefront_name ?? "");
        setBio(data.bio ?? "");
        setCountry(data.country ?? "");
        setBudget(data.min_order_budget ?? undefined);
        setInterests((data.interests ?? []).join(", "));
      }
      setLoading(false);
    })();
  }, []);

  const onSave = async () => {
    await upsertVendorProfile({
      storefront_name,
      bio,
      country,
      min_order_budget:
        typeof min_order_budget === "number" ? min_order_budget : undefined,
      interests: interests
        ? interests
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    });
    alert("Saved ✅");
  };

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="max-w-2xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Vendor Profile</h1>
      <label className="block">
        <span className="text-sm">Storefront name *</span>
        <input
          className="input input-bordered w-full"
          value={storefront_name}
          onChange={(e) => setStorefrontName(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-sm">Bio</span>
        <textarea
          className="textarea textarea-bordered w-full"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-sm">Country</span>
        <input
          className="input input-bordered w-full"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-sm">Min order budget</span>
        <input
          type="number"
          className="input input-bordered w-full"
          value={min_order_budget ?? ""}
          onChange={(e) =>
            setBudget(e.target.value ? Number(e.target.value) : undefined)
          }
        />
      </label>
      <label className="block">
        <span className="text-sm">Interests (comma separated)</span>
        <input
          className="input input-bordered w-full"
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
        />
      </label>
      <button className="btn btn-primary" onClick={onSave}>
        Save
      </button>
    </div>
  );
}
