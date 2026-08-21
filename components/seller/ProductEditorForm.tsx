"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; name: string };
type ProductVariant = {
  id?: string;
  title: string;
  sku: string;
  price: number;
  inventoryQuantity: number;
};
type InitialProduct = {
  id: string;
  title: string;
  description: string;
  basePrice: number;
  compareAtPrice: number | null;
  status: "draft" | "active";
  categoryIds: string[];
  mediaUrls: string[];
  variants: ProductVariant[];
};

const MAX_MEDIA = 10;
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const MEDIA_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export default function ProductEditorForm({
  categories,
  sellerVerified,
  initial,
}: {
  categories: Category[];
  sellerVerified: boolean;
  initial?: InitialProduct;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const initialMedia = useRef(new Set(initial?.mediaUrls ?? []));
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [basePrice, setBasePrice] = useState(initial?.basePrice.toString() ?? "");
  const [compareAtPrice, setCompareAtPrice] = useState(initial?.compareAtPrice?.toString() ?? "");
  const [variants, setVariants] = useState<ProductVariant[]>(
    initial?.variants ?? [
      { title: "Default", sku: "", price: initial?.basePrice ?? 0, inventoryQuantity: 0 },
    ],
  );
  const [status, setStatus] = useState<"draft" | "active">(initial?.status ?? "draft");
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

  const updateVariant = (
    index: number,
    patch: Partial<ProductVariant>,
  ) => {
    setVariants((current) =>
      current.map((variant, position) =>
        position === index ? { ...variant, ...patch } : variant,
      ),
    );
  };

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
    try {
      for (const file of selected) {
        const initResponse = await fetch("/api/seller/product-media/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          }),
        });
        const init = await initResponse.json().catch(() => ({}));
        if (!initResponse.ok || !init.uploadURL || !init.publicUrl) {
          throw new Error(init.error || "Unable to initialize product image upload");
        }

        const uploadResponse = await fetch(init.uploadURL, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!uploadResponse.ok) {
          throw new Error("Product image upload failed");
        }

        uploaded.push(init.publicUrl);
      }

      setMediaUrls((current) => [...current, ...uploaded]);
    } catch (caught) {
      // Best-effort cleanup of objects created in this failed batch.
      await Promise.allSettled(
        uploaded.map((publicUrl) =>
          fetch("/api/seller/product-media/upload", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicUrl }),
          }),
        ),
      );
      setError(caught instanceof Error ? caught.message : "Unable to upload product images");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeMedia(url: string) {
    setMediaUrls((current) => current.filter((value) => value !== url));

    // Existing product media is deleted by the PATCH route only after the DB
    // transaction succeeds. Newly uploaded unsaved media can be removed now.
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
    await Promise.allSettled(
      unsaved.map((publicUrl) =>
        fetch("/api/seller/product-media/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicUrl }),
        }),
      ),
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (uploading) return;
    setSubmitting(true);
    setError("");

    const payload = {
      title,
      description,
      basePrice: Number(basePrice),
      compareAtPrice: compareAtPrice ? Number(compareAtPrice) : null,
      variants,
      status,
      categoryIds,
      mediaUrls,
    };

    try {
      const response = await fetch(
        initial ? `/api/seller/products/${initial.id}` : "/api/seller/products",
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to save product");

      router.push("/dashboard/store");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save product");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove() {
    if (!initial || !window.confirm("Delete this product permanently?")) return;
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

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {!sellerVerified && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          You can save drafts now. Seller verification is required before publishing products.
        </div>
      )}

      <label className="block space-y-2">
        <span className="text-sm font-medium">Product title</span>
        <input required minLength={2} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium">Description</span>
        <textarea rows={6} maxLength={10000} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium">Selling price (USD)</span>
          <input
            required
            type="number"
            min="0.01"
            max="1000000"
            step="0.01"
            value={basePrice}
            onChange={(event) => {
              const value = event.target.value;
              setBasePrice(value);
              if (variants.length === 1 && variants[0].title === "Default") {
                updateVariant(0, { price: Number(value) });
              }
            }}
            className="w-full rounded-lg border px-3 py-2"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Compare-at price (USD)</span>
          <input type="number" min="0.01" max="1000000" step="0.01" value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
        </label>
      </div>

      <fieldset className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <legend className="text-sm font-medium">Variants and inventory</legend>
          <button
            type="button"
            onClick={() =>
              setVariants((current) => [
                ...current,
                {
                  title: `Variant ${current.length + 1}`,
                  sku: "",
                  price: Number(basePrice) || 0,
                  inventoryQuantity: 0,
                },
              ])
            }
            className="rounded-lg border px-3 py-1.5 text-sm"
          >
            Add variant
          </button>
        </div>
        {variants.map((variant, index) => (
          <div key={variant.id || index} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-4">
            <label className="space-y-1">
              <span className="text-xs text-gray-600">Title</span>
              <input
                required
                maxLength={200}
                value={variant.title}
                onChange={(event) => updateVariant(index, { title: event.target.value })}
                className="w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-gray-600">SKU</span>
              <input
                maxLength={100}
                value={variant.sku}
                onChange={(event) => updateVariant(index, { sku: event.target.value })}
                className="w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-gray-600">Price (USD)</span>
              <input
                required
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                value={variant.price || ""}
                onChange={(event) => updateVariant(index, { price: Number(event.target.value) })}
                className="w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-gray-600">Inventory</span>
              <input
                required
                type="number"
                min="0"
                max="100000000"
                step="1"
                value={variant.inventoryQuantity}
                onChange={(event) =>
                  updateVariant(index, { inventoryQuantity: Number(event.target.value) })
                }
                className="w-full rounded-lg border px-3 py-2"
              />
            </label>
            {variants.length > 1 && (
              <button
                type="button"
                onClick={() => setVariants((current) => current.filter((_, position) => position !== index))}
                className="text-left text-sm text-red-700 sm:col-span-4"
              >
                Remove variant
              </button>
            )}
          </div>
        ))}
        <p className="text-xs text-gray-500">
          Removing an existing variant deactivates it safely; completed orders keep their historical reference.
        </p>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Categories</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {categories.map((category) => (
            <label key={category.id} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
              <input type="checkbox" checked={categoryIds.includes(category.id)} onChange={() => toggleCategory(category.id)} />
              {category.name}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <legend className="text-sm font-medium">Product images</legend>
            <p className="text-xs text-gray-500">Up to 10 JPEG, PNG, or WebP images, maximum 10MB each. The first image is the catalog cover.</p>
          </div>
          <button
            type="button"
            disabled={uploading || mediaUrls.length >= MAX_MEDIA}
            onClick={() => fileInput.current?.click()}
            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload images"}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(event) => void uploadFiles(event.target.files)}
          />
        </div>
        {mediaUrls.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {mediaUrls.map((url, index) => (
              <div key={url} className="overflow-hidden rounded-lg border bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Product image ${index + 1}`} className="aspect-square w-full object-cover" />
                <div className="flex items-center justify-between gap-2 p-2 text-xs">
                  <span>{index === 0 ? "Cover image" : `Image ${index + 1}`}</span>
                  <button type="button" onClick={() => void removeMedia(url)} className="text-red-700">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </fieldset>

      <label className="block space-y-2">
        <span className="text-sm font-medium">Status</span>
        <select value={status} onChange={(e) => setStatus(e.target.value as "draft" | "active")} className="w-full rounded-lg border px-3 py-2">
          <option value="draft">Draft</option>
          <option value="active" disabled={!sellerVerified}>Active — publish to marketplace</option>
        </select>
      </label>

      <div className="flex flex-wrap gap-3 border-t pt-5">
        <button type="submit" disabled={submitting || uploading} className="rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white disabled:opacity-50">
          {submitting ? "Saving…" : initial ? "Save changes" : "Create product"}
        </button>
        <button type="button" disabled={submitting} onClick={() => void cancel()} className="rounded-lg border px-5 py-2.5 disabled:opacity-50">Cancel</button>
        {initial && (
          <button type="button" onClick={remove} disabled={submitting} className="ml-auto rounded-lg border border-red-300 px-5 py-2.5 text-red-700 disabled:opacity-50">Delete product</button>
        )}
      </div>
    </form>
  );
}
