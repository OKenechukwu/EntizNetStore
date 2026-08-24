"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Category = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_adult: boolean | null;
  sort_order: number | null;
  is_active: boolean | null;
};

type Brand = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  website: string | null;
  is_verified: boolean | null;
  is_active: boolean;
};

type CategoryForm = {
  id: string;
  name: string;
  slug: string;
  description: string;
  parentId: string;
  isAdult: boolean;
  isActive: boolean;
  sortOrder: number;
};

type BrandForm = {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  bannerUrl: string;
  website: string;
  isVerified: boolean;
  isActive: boolean;
};

const emptyCategory: CategoryForm = {
  id: "",
  name: "",
  slug: "",
  description: "",
  parentId: "",
  isAdult: false,
  isActive: true,
  sortOrder: 0,
};

const emptyBrand: BrandForm = {
  id: "",
  name: "",
  slug: "",
  description: "",
  logoUrl: "",
  bannerUrl: "",
  website: "",
  isVerified: false,
  isActive: true,
};

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : fallback;
}

export default function CatalogGovernancePanel() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategory);
  const [brandForm, setBrandForm] = useState<BrandForm>(emptyBrand);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"category" | "brand" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [categoryResponse, brandResponse] = await Promise.all([
        fetch("/api/admin/categories", { cache: "no-store" }),
        fetch("/api/admin/brands", { cache: "no-store" }),
      ]);
      if (!categoryResponse.ok) throw new Error(await responseError(categoryResponse, "Unable to load categories"));
      if (!brandResponse.ok) throw new Error(await responseError(brandResponse, "Unable to load brands"));
      const categoryBody = await categoryResponse.json();
      const brandBody = await brandResponse.json();
      setCategories(categoryBody.categories ?? []);
      setBrands(brandBody.brands ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load catalogue governance data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  function editCategory(category: Category) {
    setNotice(null);
    setCategoryForm({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      parentId: category.parent_id ?? "",
      isAdult: Boolean(category.is_adult),
      isActive: category.is_active !== false,
      sortOrder: category.sort_order ?? 0,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editBrand(brand: Brand) {
    setNotice(null);
    setBrandForm({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      description: brand.description ?? "",
      logoUrl: brand.logo_url ?? "",
      bannerUrl: brand.banner_url ?? "",
      website: brand.website ?? "",
      isVerified: Boolean(brand.is_verified),
      isActive: brand.is_active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveCategory(event: FormEvent) {
    event.preventDefault();
    setSaving("category");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/categories", {
        method: categoryForm.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: categoryForm.id || null,
          name: categoryForm.name,
          slug: categoryForm.slug || null,
          description: categoryForm.description || null,
          parentId: categoryForm.parentId || null,
          isAdult: categoryForm.isAdult,
          isActive: categoryForm.isActive,
          sortOrder: categoryForm.sortOrder,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Unable to save category"));
      setNotice(categoryForm.id ? "Category updated and audited." : "Category created and audited.");
      setCategoryForm(emptyCategory);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save category");
    } finally {
      setSaving(null);
    }
  }

  async function saveBrand(event: FormEvent) {
    event.preventDefault();
    setSaving("brand");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/brands", {
        method: brandForm.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: brandForm.id || null,
          name: brandForm.name,
          slug: brandForm.slug || null,
          description: brandForm.description || null,
          logoUrl: brandForm.logoUrl,
          bannerUrl: brandForm.bannerUrl,
          website: brandForm.website,
          isVerified: brandForm.isVerified,
          isActive: brandForm.isActive,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Unable to save brand"));
      setNotice(brandForm.id ? "Brand updated and audited." : "Brand created and audited.");
      setBrandForm(emptyBrand);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save brand");
    } finally {
      setSaving(null);
    }
  }

  async function deleteCategory(category: Category) {
    if (!window.confirm(`Delete category “${category.name}”? Deletion is blocked when products or subcategories still reference it.`)) return;
    setError(null);
    setNotice(null);
    const response = await fetch(`/api/admin/categories?id=${encodeURIComponent(category.id)}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await responseError(response, "Unable to delete category"));
      return;
    }
    if (categoryForm.id === category.id) setCategoryForm(emptyCategory);
    setNotice("Category deleted and audited.");
    await load();
  }

  async function deleteBrand(brand: Brand) {
    if (!window.confirm(`Delete brand “${brand.name}”? Deletion is blocked while products still reference it.`)) return;
    setError(null);
    setNotice(null);
    const response = await fetch(`/api/admin/brands?id=${encodeURIComponent(brand.id)}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await responseError(response, "Unable to delete brand"));
      return;
    }
    if (brandForm.id === brand.id) setBrandForm(emptyBrand);
    setNotice("Brand deleted and audited.");
    await load();
  }

  return (
    <div className="space-y-10">
      {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">{notice}</div>}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <form onSubmit={saveCategory} className="space-y-4 rounded-xl border p-5">
          <div>
            <h2 className="text-xl font-semibold">{categoryForm.id ? "Edit category" : "Create category"}</h2>
            <p className="mt-1 text-sm opacity-65">Adult/general classification is explicit. New categories default to general.</p>
          </div>
          <label className="block text-sm">Name<input className="mt-1 w-full rounded-md border bg-transparent px-3 py-2" value={categoryForm.name} onChange={(e) => setCategoryForm((v) => ({ ...v, name: e.target.value }))} required maxLength={120} /></label>
          <label className="block text-sm">Slug<input className="mt-1 w-full rounded-md border bg-transparent px-3 py-2" value={categoryForm.slug} onChange={(e) => setCategoryForm((v) => ({ ...v, slug: e.target.value }))} placeholder="auto-generated when empty" maxLength={160} /></label>
          <label className="block text-sm">Parent<select className="mt-1 w-full rounded-md border bg-transparent px-3 py-2" value={categoryForm.parentId} onChange={(e) => setCategoryForm((v) => ({ ...v, parentId: e.target.value }))}><option value="">Top level</option>{categories.filter((category) => category.id !== categoryForm.id).map((category) => <option key={category.id} value={category.id}>{category.name}{category.is_active === false ? " (inactive)" : ""}</option>)}</select></label>
          <label className="block text-sm">Description<textarea className="mt-1 min-h-24 w-full rounded-md border bg-transparent px-3 py-2" value={categoryForm.description} onChange={(e) => setCategoryForm((v) => ({ ...v, description: e.target.value }))} maxLength={4000} /></label>
          <label className="block text-sm">Sort order<input type="number" min={0} max={100000} className="mt-1 w-full rounded-md border bg-transparent px-3 py-2" value={categoryForm.sortOrder} onChange={(e) => setCategoryForm((v) => ({ ...v, sortOrder: Number(e.target.value) }))} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={categoryForm.isAdult} onChange={(e) => setCategoryForm((v) => ({ ...v, isAdult: e.target.checked }))} /> Adult/restricted category</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={categoryForm.isActive} onChange={(e) => setCategoryForm((v) => ({ ...v, isActive: e.target.checked }))} /> Active for Seller catalogue assignment</label>
          <div className="flex gap-2"><button disabled={saving === "category"} className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black">{saving === "category" ? "Saving…" : categoryForm.id ? "Save category" : "Create category"}</button>{categoryForm.id && <button type="button" className="rounded-md border px-4 py-2 text-sm" onClick={() => setCategoryForm(emptyCategory)}>Cancel</button>}</div>
        </form>

        <div className="rounded-xl border p-5">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Categories</h2><p className="text-sm opacity-65">{categories.length} taxonomy records</p></div><button className="rounded-md border px-3 py-2 text-sm" onClick={() => void load()}>Refresh</button></div>
          {loading ? <p className="py-8 text-sm opacity-65">Loading categories…</p> : categories.length === 0 ? <p className="py-8 text-sm opacity-65">No categories configured.</p> : <div className="space-y-2">{categories.map((category) => <div key={category.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{category.name}</span><span className="rounded-full border px-2 py-0.5 text-xs">{category.is_adult ? "Adult" : "General"}</span>{category.is_active === false && <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-xs">Inactive</span>}</div><p className="mt-1 text-xs opacity-60">/{category.slug}{category.parent_id ? ` · child of ${categoryNames.get(category.parent_id) ?? category.parent_id}` : " · top level"} · order {category.sort_order ?? 0}</p></div><div className="flex gap-2"><button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => editCategory(category)}>Edit</button><button className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm" onClick={() => void deleteCategory(category)}>Delete</button></div></div>)}</div>}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <form onSubmit={saveBrand} className="space-y-4 rounded-xl border p-5">
          <div><h2 className="text-xl font-semibold">{brandForm.id ? "Edit brand" : "Create brand"}</h2><p className="mt-1 text-sm opacity-65">Retirement is non-destructive; existing products keep history while Seller reassignment is blocked.</p></div>
          <label className="block text-sm">Name<input className="mt-1 w-full rounded-md border bg-transparent px-3 py-2" value={brandForm.name} onChange={(e) => setBrandForm((v) => ({ ...v, name: e.target.value }))} required maxLength={120} /></label>
          <label className="block text-sm">Slug<input className="mt-1 w-full rounded-md border bg-transparent px-3 py-2" value={brandForm.slug} onChange={(e) => setBrandForm((v) => ({ ...v, slug: e.target.value }))} placeholder="auto-generated when empty" maxLength={160} /></label>
          <label className="block text-sm">Description<textarea className="mt-1 min-h-20 w-full rounded-md border bg-transparent px-3 py-2" value={brandForm.description} onChange={(e) => setBrandForm((v) => ({ ...v, description: e.target.value }))} maxLength={4000} /></label>
          <label className="block text-sm">Website<input type="url" className="mt-1 w-full rounded-md border bg-transparent px-3 py-2" value={brandForm.website} onChange={(e) => setBrandForm((v) => ({ ...v, website: e.target.value }))} /></label>
          <label className="block text-sm">Logo URL<input type="url" className="mt-1 w-full rounded-md border bg-transparent px-3 py-2" value={brandForm.logoUrl} onChange={(e) => setBrandForm((v) => ({ ...v, logoUrl: e.target.value }))} /></label>
          <label className="block text-sm">Banner URL<input type="url" className="mt-1 w-full rounded-md border bg-transparent px-3 py-2" value={brandForm.bannerUrl} onChange={(e) => setBrandForm((v) => ({ ...v, bannerUrl: e.target.value }))} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={brandForm.isVerified} onChange={(e) => setBrandForm((v) => ({ ...v, isVerified: e.target.checked }))} /> Verified brand</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={brandForm.isActive} onChange={(e) => setBrandForm((v) => ({ ...v, isActive: e.target.checked }))} /> Active for Seller catalogue assignment</label>
          <div className="flex gap-2"><button disabled={saving === "brand"} className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black">{saving === "brand" ? "Saving…" : brandForm.id ? "Save brand" : "Create brand"}</button>{brandForm.id && <button type="button" className="rounded-md border px-4 py-2 text-sm" onClick={() => setBrandForm(emptyBrand)}>Cancel</button>}</div>
        </form>

        <div className="rounded-xl border p-5">
          <div className="mb-4"><h2 className="text-xl font-semibold">Brands</h2><p className="text-sm opacity-65">{brands.length} brand records</p></div>
          {loading ? <p className="py-8 text-sm opacity-65">Loading brands…</p> : brands.length === 0 ? <p className="py-8 text-sm opacity-65">No brands configured.</p> : <div className="space-y-2">{brands.map((brand) => <div key={brand.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{brand.name}</span>{brand.is_verified && <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 text-xs">Verified</span>}{!brand.is_active && <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-xs">Retired</span>}</div><p className="mt-1 text-xs opacity-60">/{brand.slug}{brand.website ? ` · ${brand.website}` : ""}</p></div><div className="flex gap-2"><button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => editBrand(brand)}>Edit</button><button className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm" onClick={() => void deleteBrand(brand)}>Delete</button></div></div>)}</div>}
        </div>
      </section>
    </div>
  );
}
