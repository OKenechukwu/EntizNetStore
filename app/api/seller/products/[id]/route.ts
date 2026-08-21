import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { productMediaPathFromPublicUrl } from "@/lib/storage/productMedia";
import {
  deleteProductMediaPaths,
  verifyOwnedProductMediaUrls,
} from "@/lib/storage/productMediaServer";
import { sellerProductSchema } from "../validation";

function canonicalPaths(userId: string, urls: string[]) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return [];
  return urls
    .map((url) => productMediaPathFromPublicUrl(url, supabaseUrl, userId))
    .filter((value): value is string => Boolean(value));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: ownedProduct } = await supabase
    .from("products")
    .select("id")
    .eq("id", id)
    .eq("seller_id", user.id)
    .maybeSingle();
  if (!ownedProduct) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const parsed = sellerProductSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid product data" },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const media = await verifyOwnedProductMediaUrls(user.id, input.mediaUrls);
  if (!media.ok) {
    return NextResponse.json({ error: media.error }, { status: 400 });
  }

  const { data: oldMedia } = await supabase
    .from("product_media")
    .select("url")
    .eq("product_id", id);
  const oldPaths = canonicalPaths(user.id, (oldMedia ?? []).map((item) => item.url));
  const nextPaths = new Set(media.paths);

  const { data, error } = await supabase.rpc("seller_save_product_v2", {
    p_product_id: id,
    p_title: input.title,
    p_description: input.description,
    p_base_price: input.basePrice,
    p_compare_at_price: input.compareAtPrice,
    p_status: input.status,
    p_category_ids: input.categoryIds,
    p_media_urls: input.mediaUrls,
    p_variants: input.variants,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await deleteProductMediaPaths(oldPaths.filter((path) => !nextPaths.has(path)));
  return NextResponse.json({ id: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: ownedProduct } = await supabase
    .from("products")
    .select("id")
    .eq("id", id)
    .eq("seller_id", user.id)
    .maybeSingle();
  if (!ownedProduct) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const { data: oldMedia } = await supabase
    .from("product_media")
    .select("url")
    .eq("product_id", id);
  const oldPaths = canonicalPaths(user.id, (oldMedia ?? []).map((item) => item.url));

  const { data, error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("seller_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  await deleteProductMediaPaths(oldPaths);
  return NextResponse.json({ deleted: true });
}
