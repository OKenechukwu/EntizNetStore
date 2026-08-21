import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { sellerProductSchema } from "./validation";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = sellerProductSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid product data" },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const { data, error } = await supabase.rpc("seller_save_product_v2", {
    p_product_id: null,
    p_title: input.title,
    p_description: input.description,
    p_base_price: input.basePrice,
    p_compare_at_price: input.compareAtPrice,
    p_status: input.status,
    p_category_ids: input.categoryIds,
    p_media_urls: input.mediaUrls,
    p_variants: input.variants,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ id: data }, { status: 201 });
}
