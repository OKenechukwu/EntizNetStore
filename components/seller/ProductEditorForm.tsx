"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; name: string };
type Brand = { id: string; name: string };
type ProductVariant = {
  id?: string;
  title: string;
  option1: string;
  option2: string;
  option3: string;
  sku: string;
  barcode: string;
  price: number;
  compareAtPrice: number | null;
  costPerItem: number | null;
  trackInventory: boolean;
  inventoryQuantity: number;
  inventoryPolicy: "deny" | "continue";
  weightGrams: number | null;
  requiresShipping: boolean;
  isActive: boolean;
};
type InitialProduct = {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  productType: "physical" | "digital";
  basePrice: number;
  compareAtPrice: number | null;
  costPerItem: number | null;
  brandId: string | null;
  status: string;
  moderationStatus: "not_submitted" | "pending" | "approved" | "rejected";
  moderationNotes: string | null;
  categoryIds: string[];
  mediaUrls: string[];
  variants: ProductVariant[];
  trackInventory: boolean;
  continueSelling: boolean;
  requiresShipping: boolean;
  isTaxable: boolean;
  weightGrams: number | null;
  material: string;
  ageRestriction: number;
  tags: string[];
  searchKeywords: string[];
};

const MAX_MEDIA = 10;
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const MEDIA_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function defaultVariant(basePrice = 0, requiresShipping = true): ProductVariant {
  return {
    title: "Default",
    option1: "",
    option2: "",
    option3: "",
    sku: "",
    barcode: "",
    price: basePrice,
    compareAtPrice: null,
    costPerItem: null,
    trackInventory: true,
    inventoryQuantity: 0,
    inventoryPolicy: "deny",
    weightGrams: null,
    requiresShipping,
    isActive: true,
  };
}

function optionalNumber(value: string): number | null {
  return value.trim() ? Number(value) : null;
}

function csvValues(value: string) {
  return Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean)));
}

export default function ProductEditorForm({
  categories,
  brands,
  sellerVerified,
  initial,
}: {
  categories: Category[];
  brands: Brand[];
  sellerVerified: boolean;
  initial?: InitialProduct;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const initialMedia = useRef(new Set(initial?.mediaUrls ?? []));

  const [title, setTitle] = useState(initial?.title ?? "");
  const [shortDescription, setShortDescription] = useState(initial?.shortDescription ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [productType, setProductType] = useState<"physical" | "digital">(initial?.productType ?? "physical");
  const [brandId, setBrandId] = useState(initial?.brandId ?? "");
  const [basePrice, setBasePrice] = useState(initial?.basePrice.toString() ?? "");
  const [compareAtPrice, setCompareAtPrice] = useState(initial?.compareAtPrice?.toString() ?? "");
  const [costPerItem, setCostPerItem] = useState(initial?.costPerItem?.toString() ?? "");
  const [trackInventory, setTrackInventory] = useState(initial?.trackInventory ?? true);
  const [continueSelling, setContinueSelling] = useState(initial?.continueSelling ?? false);
  const [requiresShipping, setRequiresShipping] = useState(initial?.requiresShipping ?? true);
  const [isTaxable, setIsTaxable] = useState(initial?.isTaxable ?? true);
  const [weightGrams, setWeightGrams] = useState(initial?.weightGrams?.toString() ?? "");
  const [material, setMaterial] = useState(initial?.material ?? "");
  const [ageRestriction, setAgeRestriction] = useState(String(initial?.ageRestriction ?? 18));
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [searchKeywords, setSearchKeywords] = useState((initial?.searchKeywords ?? []).join(", "));
  const [variants, setVariants] = useState<ProductVariant[]>(
    initial?.variants?.length ? initial.variants : [defaultVariant(initial?.basePrice ?? 0, initial?.requiresShipping ?? true)],
  );
  const [categoryIds, setCategoryIds] = useState<string[]>(initial?.categoryIds ?? []);
  const [mediaUrls, setMediaUrls] = useState<string[]>(initial?.mediaUrls ?? []);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const toggleCategory = (id: string) => {
    setCategoryIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const updateVariant = (index: number, patch: Partial<ProductVariant>) => {
    setVariants((current) =>
      current.map((variant, position) => position === index ? { ...variant, ...patch } : variant),
    );
  };

  function changeProductType(next: "physical" | "digital") {
    setProductType(next);
    if (next === "digital") {
      setRequiresShipping(false);
      setVariants((current) => current.map((variant) => ({ ...variant, requiresShipping: false })));
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setError("");

    const selected = Array.from(files);
    if (mediaUrls.length + selected.length > MAX_MEDIA) {
      setError(`A product can have up to ${MAX_MEDIA} images.`);
      return;
    }

    const invalid = selected.find(
      (file) => !MEDIA_TYPES.has(file.type.toLowerCase()) || file.size <= 0 || file.size > MAX_MEDIA_BYTES,
    );
    if (invalid) {
      setError("Product images must be JPEG, PNG, or WebP and no larger than 10MB each.");
      return;
    }

    setUploading(true);
    const uploaded: string[] = [];
    const pendingUploadIds = new Set<string>();
    try {
      for (const file of selected) {
        const initResponse = await fetch("/api/seller/product-media/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType: file.type }),
        });
        const init = await initResponse.json().catch(() => ({}));
        if (!initResponse.ok || !init.uploadURL || !init.uploadId) {
          throw new Error(init.error || "Unable to initialize product image upload");
        }
        pendingUploadIds.add(init.uploadId);

        const uploadResponse = await fetch(init.uploadURL, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!uploadResponse.ok) throw new Error("Product image quarantine upload failed");

        const finalizeResponse = await fetch("/api/seller/product-media/upload", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId: init.uploadId }),
        });
        const finalized = await finalizeResponse.json().catch(() => ({}));
        if (!finalizeResponse.ok || !finalized.publicUrl) {
          throw new Error(finalized.error || "Product image did not pass upload safety verification");
        }

        pendingUploadIds.delete(init.uploadId);
        uploaded.push(finalized.publicUrl);
      }
      setMediaUrls((current) => [...current, ...uploaded]);
    } catch (caught) {
      await Promise.allSettled([
        ...uploaded.map((publicUrl) =>
          fetch("/api/seller/product-media/upload", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicUrl }),
          }),
        ),
        ...Array.from(pendingUploadIds).map((uploadId) =>
          fetch("/api/seller/product-media/upload", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uploadId }),
          }),
        ),
      ]);
      setError(caught instanceof Error ? caught.message : "Unable to upload product images");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeMedia(url: string) {
    setMediaUrls((current) => current.filter((value) => value !== url));
    if (!initialMedia.current.has(url)) {
      await fetch("/api/seller/product-media/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicUrl: url }),
      }).catch(() => undefined);
    }
  }

  async function cleanupUnsavedUploads() {
    const unsaved = mediaUrls.filter((url) => !initialMedia.current.has(url));
    await Promise.allSettled(unsaved.map((publicUrl) =>
      fetch("/api/seller/product-media/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicUrl }),
      }),
    ));
  }

  function payload() {
    return {
      title,
      description,
      shortDescription,
      productType,
      basePrice: Number(basePrice),
      compareAtPrice: optionalNumber(compareAtPrice),
      costPerItem: optionalNumber(costPerItem),
      brandId: brandId || null,
      categoryIds,
      mediaUrls,
      variants,
      trackInventory,
      continueSelling,
      requiresShipping,
      isTaxable,
      weightGrams: optionalNumber(weightGrams),
      material,
      ageRestriction: Number(ageRestriction),
      tags: csvValues(tags),
      searchKeywords: csvValues(searchKeywords),
    };
  }

  async function save(submitForReview: boolean) {
    if (uploading || submitting) return;
    if (submitForReview && !sellerVerified) {
      setError("Seller verification is required before submitting products for review.");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        initial ? `/api/seller/products/${initial.id}` : "/api/seller/products",
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload()),
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to save product");

      const savedId = String(result.id || initial?.id || "");
      if (submitForReview) {
        const reviewResponse = await fetch(`/api/seller/products/${savedId}/submit`, { method: "POST" });
        const reviewResult = await reviewResponse.json().catch(() => ({}));
        if (!reviewResponse.ok) throw new Error(reviewResult.error || "Product saved, but review submission failed");
      }

      router.push("/dashboard/store");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save product");
    } finally {
      setSubmitting(false);
    }
  }

  async function setPublication(active: boolean) {
    if (!initial || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/seller/products/${initial.id}/publication`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to change publication state");
      router.push("/dashboard/store");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to change publication state");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove() {
    if (!initial || !window.confirm("Delete this product permanently? Products with order history cannot be deleted.")) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/seller/products/${initial.id}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to delete product");
      router.push("/dashboard/store");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete product");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel() {
    await cleanupUnsavedUploads();
    router.push("/dashboard/store");
  }

  const moderationLabel = initial?.moderationStatus?.replace("_", " ") ?? "not submitted";
  const savingInvalidatesApproval = initial?.moderationStatus === "approved" || initial?.moderationStatus === "pending";

  return (
    <form onSubmit={(event) => { event.preventDefault(); void save(false); }} className="space-y-8">
      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <div className="rounded-xl border bg-black/[0.02] p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Moderation:</span>
          <span className="rounded-full border px-2 py-0.5 capitalize">{moderationLabel}</span>
          {initial?.status && <span className="opacity-60">Publication: {initial.status}</span>}
        </div>
        {!sellerVerified && <p className="mt-2 text-amber-800">You can build drafts now. Seller verification is required before review submission.</p>}
        {initial?.moderationStatus === "pending" && <p className="mt-2 text-amber-800">This revision is awaiting Admin review. Saving changes withdraws it and creates a new draft revision.</p>}
        {initial?.moderationStatus === "approved" && <p className="mt-2 text-amber-800">This revision is approved. Saving any catalogue change immediately unpublishes it and requires a fresh review.</p>}
        {initial?.moderationStatus === "rejected" && initial.moderationNotes && <p className="mt-2 text-red-700"><strong>Review notes:</strong> {initial.moderationNotes}</p>}
      </div>

      <section className="space-y-5 rounded-2xl border p-5">
        <div><h2 className="text-lg font-semibold">Catalogue identity</h2><p className="text-sm opacity-65">Customer-facing information used in search and storefronts.</p></div>
        <label className="block space-y-2"><span className="text-sm font-medium">Product title</span><input required minLength={2} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border px-3 py-2" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2"><span className="text-sm font-medium">Product type</span><select value={productType} onChange={(e) => changeProductType(e.target.value as "physical" | "digital")} className="w-full rounded-lg border px-3 py-2"><option value="physical">Physical</option><option value="digital">Digital</option></select></label>
          <label className="space-y-2"><span className="text-sm font-medium">Brand</span><select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="w-full rounded-lg border px-3 py-2"><option value="">Unbranded / Seller brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
        </div>
        <label className="block space-y-2"><span className="text-sm font-medium">Short description</span><input maxLength={500} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="One concise line for catalogue cards and previews" /></label>
        <label className="block space-y-2"><span className="text-sm font-medium">Full description</span><textarea rows={7} maxLength={10000} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border px-3 py-2" /></label>
      </section>

      <section className="space-y-5 rounded-2xl border p-5">
        <div><h2 className="text-lg font-semibold">Pricing & commerce</h2><p className="text-sm opacity-65">Base pricing and internal cost data. Cost is never exposed publicly.</p></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-2"><span className="text-sm font-medium">Selling price (USD)</span><input required type="number" min="0.01" max="1000000" step="0.01" value={basePrice} onChange={(event) => { const value = event.target.value; setBasePrice(value); if (variants.length === 1 && variants[0].title === "Default") updateVariant(0, { price: Number(value) }); }} className="w-full rounded-lg border px-3 py-2" /></label>
          <label className="space-y-2"><span className="text-sm font-medium">Compare-at price</span><input type="number" min="0.01" max="1000000" step="0.01" value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} className="w-full rounded-lg border px-3 py-2" /></label>
          <label className="space-y-2"><span className="text-sm font-medium">Cost per item</span><input type="number" min="0" max="1000000" step="0.01" value={costPerItem} onChange={(e) => setCostPerItem(e.target.value)} className="w-full rounded-lg border px-3 py-2" /></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={trackInventory} onChange={(e) => setTrackInventory(e.target.checked)} /> Track inventory</label>
          <label className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={continueSelling} onChange={(e) => setContinueSelling(e.target.checked)} /> Continue when out of stock</label>
          <label className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={requiresShipping} disabled={productType === "digital"} onChange={(e) => setRequiresShipping(e.target.checked)} /> Requires shipping</label>
          <label className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={isTaxable} onChange={(e) => setIsTaxable(e.target.checked)} /> Taxable</label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-2"><span className="text-sm font-medium">Weight (grams)</span><input type="number" min="0" step="1" value={weightGrams} onChange={(e) => setWeightGrams(e.target.value)} className="w-full rounded-lg border px-3 py-2" /></label>
          <label className="space-y-2"><span className="text-sm font-medium">Material</span><input maxLength={200} value={material} onChange={(e) => setMaterial(e.target.value)} className="w-full rounded-lg border px-3 py-2" /></label>
          <label className="space-y-2"><span className="text-sm font-medium">Minimum age</span><input required type="number" min="18" max="99" step="1" value={ageRestriction} onChange={(e) => setAgeRestriction(e.target.value)} className="w-full rounded-lg border px-3 py-2" /></label>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border p-5">
        <div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">Variants & inventory</h2><p className="text-sm opacity-65">SKU-level price, stock, fulfillment and availability.</p></div><button type="button" onClick={() => setVariants((current) => [...current, { ...defaultVariant(Number(basePrice) || 0, requiresShipping), title: `Variant ${current.length + 1}` }])} className="rounded-lg border px-3 py-2 text-sm">Add variant</button></div>
        {variants.map((variant, index) => (
          <div key={variant.id || index} className="space-y-3 rounded-xl border p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1"><span className="text-xs opacity-65">Title</span><input required maxLength={200} value={variant.title} onChange={(e) => updateVariant(index, { title: e.target.value })} className="w-full rounded-lg border px-3 py-2" /></label>
              <label className="space-y-1"><span className="text-xs opacity-65">SKU</span><input maxLength={100} value={variant.sku} onChange={(e) => updateVariant(index, { sku: e.target.value })} className="w-full rounded-lg border px-3 py-2" /></label>
              <label className="space-y-1"><span className="text-xs opacity-65">Barcode</span><input maxLength={100} value={variant.barcode} onChange={(e) => updateVariant(index, { barcode: e.target.value })} className="w-full rounded-lg border px-3 py-2" /></label>
              <label className="space-y-1"><span className="text-xs opacity-65">Option / value</span><input maxLength={100} value={variant.option1} onChange={(e) => updateVariant(index, { option1: e.target.value })} placeholder="e.g. Black / Large" className="w-full rounded-lg border px-3 py-2" /></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1"><span className="text-xs opacity-65">Price</span><input required type="number" min="0.01" step="0.01" value={variant.price || ""} onChange={(e) => updateVariant(index, { price: Number(e.target.value) })} className="w-full rounded-lg border px-3 py-2" /></label>
              <label className="space-y-1"><span className="text-xs opacity-65">Compare-at</span><input type="number" min="0.01" step="0.01" value={variant.compareAtPrice ?? ""} onChange={(e) => updateVariant(index, { compareAtPrice: optionalNumber(e.target.value) })} className="w-full rounded-lg border px-3 py-2" /></label>
              <label className="space-y-1"><span className="text-xs opacity-65">Cost</span><input type="number" min="0" step="0.01" value={variant.costPerItem ?? ""} onChange={(e) => updateVariant(index, { costPerItem: optionalNumber(e.target.value) })} className="w-full rounded-lg border px-3 py-2" /></label>
              <label className="space-y-1"><span className="text-xs opacity-65">Inventory</span><input required type="number" min="0" step="1" value={variant.inventoryQuantity} onChange={(e) => updateVariant(index, { inventoryQuantity: Number(e.target.value) })} className="w-full rounded-lg border px-3 py-2" /></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1"><span className="text-xs opacity-65">Inventory policy</span><select value={variant.inventoryPolicy} onChange={(e) => updateVariant(index, { inventoryPolicy: e.target.value as "deny" | "continue" })} className="w-full rounded-lg border px-3 py-2"><option value="deny">Stop at zero</option><option value="continue">Continue selling</option></select></label>
              <label className="space-y-1"><span className="text-xs opacity-65">Weight (g)</span><input type="number" min="0" step="1" value={variant.weightGrams ?? ""} onChange={(e) => updateVariant(index, { weightGrams: optionalNumber(e.target.value) })} className="w-full rounded-lg border px-3 py-2" /></label>
              <label className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={variant.trackInventory} onChange={(e) => updateVariant(index, { trackInventory: e.target.checked })} /> Track stock</label>
              <label className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={variant.requiresShipping} disabled={productType === "digital"} onChange={(e) => updateVariant(index, { requiresShipping: e.target.checked })} /> Requires shipping</label>
            </div>
            {variants.length > 1 && <button type="button" onClick={() => setVariants((current) => current.filter((_, position) => position !== index))} className="text-sm text-red-700">Remove variant</button>}
          </div>
        ))}
        <p className="text-xs opacity-60">Removing an existing variant deactivates it safely; completed orders keep their historical reference.</p>
      </section>

      <section className="space-y-4 rounded-2xl border p-5">
        <div><h2 className="text-lg font-semibold">Categories</h2><p className="text-sm opacity-65">Select up to 10 active marketplace categories.</p></div>
        <div className="grid gap-2 sm:grid-cols-2">{categories.map((category) => <label key={category.id} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={categoryIds.includes(category.id)} onChange={() => toggleCategory(category.id)} />{category.name}</label>)}</div>
      </section>

      <section className="space-y-4 rounded-2xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Product images</h2><p className="text-sm opacity-65">Up to 10 safety-scanned JPEG, PNG or WebP images. The first image is the cover.</p></div><button type="button" disabled={uploading || mediaUrls.length >= MAX_MEDIA} onClick={() => fileInput.current?.click()} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{uploading ? "Scanning upload…" : "Upload images"}</button><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => void uploadFiles(event.target.files)} /></div>
        {mediaUrls.length > 0 && <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">{mediaUrls.map((url, index) => <div key={url} className="overflow-hidden rounded-lg border bg-white">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={url} alt={`Product image ${index + 1}`} className="aspect-square w-full object-cover" /><div className="flex items-center justify-between gap-2 p-2 text-xs"><span>{index === 0 ? "Cover image" : `Image ${index + 1}`}</span><button type="button" onClick={() => void removeMedia(url)} className="text-red-700">Remove</button></div></div>)}</div>}
      </section>

      <section className="space-y-4 rounded-2xl border p-5">
        <div><h2 className="text-lg font-semibold">Discovery metadata</h2><p className="text-sm opacity-65">Comma-separated terms help catalogue search and future recommendations.</p></div>
        <label className="block space-y-2"><span className="text-sm font-medium">Tags</span><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="premium, wellness, discreet" className="w-full rounded-lg border px-3 py-2" /></label>
        <label className="block space-y-2"><span className="text-sm font-medium">Search keywords</span><input value={searchKeywords} onChange={(e) => setSearchKeywords(e.target.value)} placeholder="massage, remote, waterproof" className="w-full rounded-lg border px-3 py-2" /></label>
      </section>

      {savingInvalidatesApproval && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Saving this form creates a new draft revision and invalidates the current moderation decision.</div>}

      <div className="flex flex-wrap gap-3 border-t pt-5">
        <button type="button" disabled={submitting || uploading} onClick={() => void save(false)} className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50">{submitting ? "Saving…" : "Save Draft"}</button>
        <button type="button" disabled={submitting || uploading || !sellerVerified} onClick={() => void save(true)} className="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50">Save & Submit for Review</button>
        {initial?.moderationStatus === "approved" && initial.status === "active" && <button type="button" disabled={submitting} onClick={() => void setPublication(false)} className="rounded-lg border px-4 py-2.5">Unpublish</button>}
        {initial?.moderationStatus === "approved" && initial.status !== "active" && <button type="button" disabled={submitting} onClick={() => void setPublication(true)} className="rounded-lg border px-4 py-2.5">Republish Approved Revision</button>}
        <button type="button" disabled={submitting} onClick={() => void cancel()} className="rounded-lg border px-4 py-2.5">Cancel</button>
        {initial && <button type="button" disabled={submitting} onClick={() => void remove()} className="ml-auto rounded-lg border border-red-300 px-4 py-2.5 text-red-700">Delete Product</button>}
      </div>
    </form>
  );
}
