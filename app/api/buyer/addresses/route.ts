import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

const addressSchema = z.object({
  addressId: z.string().uuid().nullable().optional(),
  nickname: z.string().trim().max(100).nullable().optional(),
  isDefault: z.boolean().optional().default(false),
  type: z.enum(["shipping", "billing", "both"]).optional().default("shipping"),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  company: z.string().trim().max(150).nullable().optional(),
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().min(1).max(100),
  stateProvince: z.string().trim().max(100).nullable().optional(),
  postalCode: z.string().trim().min(1).max(30),
  country: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  phone: z.string().trim().max(40).nullable().optional(),
});

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("addresses")
    .select("id, nickname, is_default, type, first_name, last_name, company, address_line1, address_line2, city, state_province, postal_code, country, phone, created_at, updated_at")
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Unable to load addresses" }, { status: 500 });
  }

  return NextResponse.json({ addresses: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = addressSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid address" },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const { data, error } = await supabase.rpc("buyer_save_address", {
    p_address_id: input.addressId || null,
    p_nickname: input.nickname || null,
    p_is_default: input.isDefault,
    p_type: input.type,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_company: input.company || null,
    p_address_line1: input.addressLine1,
    p_address_line2: input.addressLine2 || null,
    p_city: input.city,
    p_state_province: input.stateProvince || null,
    p_postal_code: input.postalCode,
    p_country: input.country,
    p_phone: input.phone || null,
  });

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Unable to save address" },
      { status: error?.code === "42501" ? 403 : 400 },
    );
  }

  return NextResponse.json({ addressId: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = z.object({ addressId: z.string().uuid() }).safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const { error } = await supabase.rpc("buyer_delete_address", {
    p_address_id: parsed.data.addressId,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Unable to delete address" },
      { status: error.code === "42501" ? 403 : 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
