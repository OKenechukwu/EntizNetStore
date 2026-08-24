import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const submitReviewSchema = z.object({
  orderId: z.string().uuid(),
  productId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(200).nullable().optional(),
  content: z.string().trim().max(5000).nullable().optional(),
  isAnonymous: z.boolean().default(false),
}).refine((value) => Boolean(value.title?.trim() || value.content?.trim()), {
  message: "Review title or content is required",
});

function rpcStatus(error: { code?: string; message?: string }) {
  if (error.code === "23505") return 409;
  if (error.code === "42501" || error.code === "28000") return 403;
  if (error.code === "22023") return 400;
  return 500;
}

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { data, error } = await supabase
    .from("reviews")
    .select("id,product_id,order_id,rating,title,content,is_verified_purchase,is_anonymous,status,moderation_notes,created_at,updated_at")
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to load Buyer reviews", error);
    return NextResponse.json({ error: "Unable to load reviews" }, { status: 500 });
  }
  return NextResponse.json({ reviews: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = submitReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const { data: reviewId, error } = await supabase.rpc("buyer_submit_review", {
    p_order_id: input.orderId,
    p_product_id: input.productId,
    p_rating: input.rating,
    p_title: input.title || null,
    p_content: input.content || null,
    p_is_anonymous: input.isAnonymous,
  });

  if (error || !reviewId) {
    if ((error?.code ?? "") === "42501") return NextResponse.json({ error: error?.message || "Verified delivered purchase required" }, { status: 403 });
    if (error) return NextResponse.json({ error: error.message || "Unable to submit review" }, { status: rpcStatus(error) });
    return NextResponse.json({ error: "Unable to submit review" }, { status: 500 });
  }

  return NextResponse.json({ reviewId, status: "pending" }, { status: 201 });
}
