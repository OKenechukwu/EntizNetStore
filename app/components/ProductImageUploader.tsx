"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const MAX_BYTES = 12 * 1024 * 1024; // 12MB

export default function ProductImageUploader() {
  const [msg, setMsg] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setMsg("Please upload images under 12MB");
      return;
    }

    const path = `products/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage
      .from("store-products")
      .upload(path, file, { contentType: file.type });

    setMsg(error ? `Upload failed: ${error.message}` : "Uploaded ✅");
  }

  return (
    <div>
      <input type="file" accept="image/*" onChange={onFile} />
      <p>{msg}</p>
    </div>
  );
}
