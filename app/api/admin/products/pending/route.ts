import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const { errorResponse } = await requireAdmin();
  if (errorResponse) return errorResponse;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("products")
    .select(`
      id,
      seller_id,
      title,
      slug,
      description,
      short_description,
      type,
      base_price,
      compare_at_price,
      brand_id,
      moderation_status,
      submitted_for_review_at,
      created_at,
      profiles_seller(storefront_name, store_slug, verification_status),
      product_media(id, url, position),
      product_variants(id, title, sku, price, inventory_quantity, inventory_policy, is_active, position),
      product_categories(category_id, categories(name, slug))
    `)
    .eq("moderation_status", "pending")
    .order("submitted_for_review_at", { ascending: true })
    .limit(100);

  if (error) {
    console.error("Unable to load product moderation queue:", error);
    return NextResponse.json({ error: "Unable to load product moderation queue" }, { status: 500 });
  }

  return NextResponse.json({ products: data ?? [] });
}
