"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { upsertBSMProfile } from "./actions";

type CompanyType = "brand" | "supplier" | "manufacturer";

export default function BSMProfilePage() {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);

  const [company_name, setCompanyName] = useState("");
  const [company_type, setCompanyType] = useState<CompanyType>("manufacturer");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [logo_url, setLogoUrl] = useState("");
  const [banner_url, setBannerUrl] = useState("");
  const [categories, setCategories] = useState("");

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return setLoading(false);
      const { data } = await supabase
        .from("bsm_profile")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setCompanyName(data.company_name ?? "");
        setCompanyType(data.company_type as CompanyType);
        setCountry(data.country ?? "");
        setWebsite(data.website ?? "");
        setLogoUrl(data.logo_url ?? "");
        setBannerUrl(data.banner_url ?? "");
        setCategories((data.categories ?? []).join(", "));
      }
      setLoading(false);
    })();
  }, []);

  const onSave = async () => {
    await upsertBSMProfile({
      company_name,
      company_type,
      country,
      website,
      logo_url,
      banner_url,
      categories: categories
        ? categories
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
      <h1 className="text-2xl font-semibold">
        Brand/Supplier/Manufacturer Profile
      </h1>

      <label className="block">
        <span className="text-sm">Company name *</span>
        <input
          className="input input-bordered w-full"
          value={company_name}
          onChange={(e) => setCompanyName(e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm">Company type *</span>
        <select
          className="select select-bordered w-full"
          value={company_type}
          onChange={(e) => setCompanyType(e.target.value as CompanyType)}
        >
          <option value="brand">Brand</option>
          <option value="supplier">Supplier</option>
          <option value="manufacturer">Manufacturer</option>
        </select>
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm">Country</span>
          <input
            className="input input-bordered w-full"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm">Website</span>
          <input
            className="input input-bordered w-full"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm">Logo URL</span>
        <input
          className="input input-bordered w-full"
          value={logo_url}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://... or bucket path userId/logo.png"
        />
      </label>

      <label className="block">
        <span className="text-sm">Banner URL</span>
        <input
          className="input input-bordered w-full"
          value={banner_url}
          onChange={(e) => setBannerUrl(e.target.value)}
          placeholder="https://... or bucket path userId/banner.jpg"
        />
      </label>

      <label className="block">
        <span className="text-sm">Categories (comma separated)</span>
        <input
          className="input input-bordered w-full"
          value={categories}
          onChange={(e) => setCategories(e.target.value)}
        />
      </label>

      <button className="btn btn-primary" onClick={onSave}>
        Save
      </button>
    </div>
  );
}
