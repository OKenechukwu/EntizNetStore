import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifyOwnedProductMediaUrls } from "@/lib/storage/productMediaServer";
import { sellerProductSchema } from "./validation";
import { sellerProductRpcArgs } from "./rpc";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: seller } = await supabase
    .from("profiles_seller")
    .select("id, verification_status")
    .eq("id", user.id)
    .maybeSingle();
  if (!seller) {
    return NextResponse.json({ error: "Seller capability required" }, { status: 403 });
  }
  if (seller.verification_status === "suspended") {
    return NextResponse.json({ error: "Seller account is suspended" }, { status: 403 });
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

  const { data, error } = await supabase.rpc(
    "seller_save_product_v3",
    sellerProductRpcArgs(null, input),
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(
    { id: data, moderationStatus: "not_submitted", status: "draft" },
    { status: 201 },
  );
}
