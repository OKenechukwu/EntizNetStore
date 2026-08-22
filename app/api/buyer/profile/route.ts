import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const buyerProfileSchema = z.object({
  display_name: z.string().trim().max(100).optional().default(""),
  first_name: z.string().trim().max(100).optional().default(""),
  last_name: z.string().trim().max(100).optional().default(""),
  gender: z.enum(["male", "female", "non-binary", "prefer-not-to-say"]).nullable().optional(),
  date_of_birth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  country: z.string().trim().regex(/^[A-Za-z]{2}$/).nullable().optional(),
  phone: z.string().trim().max(40).optional().default(""),
  interests: z.array(z.string().trim().min(1).max(120)).max(50).optional().default([]),
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

  const { data: buyer, error: buyerError } = await supabase
    .from("profiles_buyer")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (buyerError || !buyer) {
    return NextResponse.json({ error: "Buyer capability required" }, { status: 403 });
  }

  const parsed = buyerProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid buyer profile" },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("profiles_buyer")
    .update({
      display_name: parsed.data.display_name || null,
      first_name: parsed.data.first_name || null,
      last_name: parsed.data.last_name || null,
      gender: parsed.data.gender ?? null,
      date_of_birth: parsed.data.date_of_birth ?? null,
      country: parsed.data.country?.toUpperCase() ?? null,
      phone: parsed.data.phone || null,
      interests: parsed.data.interests,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    console.error("Unable to update Buyer profile:", error);
    return NextResponse.json({ error: "Unable to update buyer profile" }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
