import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const storefrontSchema = z.object({
  storefrontName: z.string().trim().min(2).max(100),
  bio: z.string().trim().max(2000).default(""),
  shippingPolicy: z.string().trim().max(5000).default(""),
  returnPolicy: z.string().trim().max(5000).default(""),
});

export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: seller, error: sellerError } = await supabase
    .from("profiles_seller")
    .select("id, store_slug, verification_status")
    .eq("id", user.id)
    .maybeSingle();

  if (sellerError || !seller) {
    return NextResponse.json({ error: "Seller capability required" }, { status: 403 });
  }

  const parsed = storefrontSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid storefront profile" },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("profiles_seller")
    .update({
      storefront_name: parsed.data.storefrontName,
      bio: parsed.data.bio || null,
      shipping_policy: parsed.data.shippingPolicy || null,
      return_policy: parsed.data.returnPolicy || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("storefront_name, store_slug, bio, shipping_policy, return_policy, verification_status")
    .maybeSingle();

  if (error || !data) {
    console.error("Unable to update Seller storefront profile:", error);
    return NextResponse.json({ error: "Unable to update storefront profile" }, { status: 500 });
  }

  // store_slug is intentionally not accepted as input and is not updated here.
  // M2 treats it as a stable public identifier even when a Seller renames a store.
  return NextResponse.json({ storefront: data });
}
