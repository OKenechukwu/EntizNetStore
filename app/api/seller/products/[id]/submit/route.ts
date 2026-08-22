import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.rpc("seller_submit_product_for_review", {
    p_product_id: id,
  });

  if (error) {
    const message = error.message;
    const status = message.includes("verification_required") ? 403
      : message.includes("not_found_or_access_denied") ? 404
      : message.includes("already_pending") ? 409
      : 400;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ success: true, moderationStatus: "pending", status: "draft" });
}
