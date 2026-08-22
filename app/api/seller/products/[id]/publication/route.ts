import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

const publicationSchema = z.object({ active: z.boolean() });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = publicationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid publication state is required" }, { status: 400 });
  }

  const { error } = await supabase.rpc("seller_set_product_publication", {
    p_product_id: id,
    p_active: parsed.data.active,
  });

  if (error) {
    const message = error.message;
    const status = message.includes("approval_required") || message.includes("verification_required")
      ? 403
      : message.includes("not_found_or_access_denied") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({
    success: true,
    status: parsed.data.active ? "active" : "inactive",
  });
}
