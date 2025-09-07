// app/internal/upload-product-image/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { v4 as uuidv4 } from "uuid";

type Product = {
  id: string;
  title: string | null;
  images: string[] | null;
};

export default function UploadProductImagePage() {
  const searchParams = useSearchParams();
  const preselectPid = searchParams.get("pid") ?? "";

  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<string>(preselectPid);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, images")
        .order("title", { ascending: true });

      if (error) {
        setMessage(`Error loading products: ${error.message}`);
      } else {
        setProducts(data || []);
      }
    };
    load();
  }, []);

  const handleUpload = async () => {
    setMessage("");
    if (!productId) return setMessage("Please select a product.");
    if (!file) return setMessage("Please choose an image file.");

    try {
      setIsUploading(true);

      const ext = file.name.split(".").pop() || "jpg";
      const safeName = `${uuidv4()}.${ext}`;
      const path = `${productId}/${safeName}`;

      // Upload to storage bucket
      const { error: uploadErr } = await supabase.storage
        .from("store-products")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadErr) throw uploadErr;

      // Get public URL
      const { data: pub } = supabase.storage
        .from("store-products")
        .getPublicUrl(path);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) throw new Error("Could not get public URL");

      // Fetch current images for this product
      const { data: currentRow, error: fetchErr } = await supabase
        .from("products")
        .select("images")
        .eq("id", productId)
        .single();

      if (fetchErr) throw fetchErr;

      const currentImages: string[] = Array.isArray(currentRow?.images)
        ? currentRow!.images.filter(Boolean)
        : [];

      // Put new URL at the front
      const updatedImages = [publicUrl, ...currentImages];

      const { error: updateErr } = await supabase
        .from("products")
        .update({ images: updatedImages })
        .eq("id", productId);

      if (updateErr) throw updateErr;

      setMessage(
        "✅ Uploaded and saved! First image = preview on /store list.",
      );
      setFile(null);
    } catch (e: any) {
      setMessage(`❌ ${e.message || "Upload failed"}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">Upload Product Image</h1>

      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Product</span>
          <select
            className="mt-1 w-full border rounded-lg px-3 py-2"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">Select product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title || p.id}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium">Image file</span>
          <input
            className="mt-1 w-full border rounded-lg px-3 py-2"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <button
          onClick={handleUpload}
          disabled={isUploading}
          className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
        >
          {isUploading ? "Uploading…" : "Upload"}
        </button>

        {message && <p className="text-sm mt-2">{message}</p>}

        <div className="pt-6 text-xs text-gray-500">
          Tip: The newest upload becomes <code>images[0]</code>. Your{" "}
          <code>/store</code> list already uses <code>images[0]</code> as
          preview.
        </div>
      </div>
    </div>
  );
}
