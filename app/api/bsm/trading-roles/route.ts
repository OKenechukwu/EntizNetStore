import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

const tradingRole = z.enum([
  "brand",
  "supplier",
  "manufacturer",
  "distributor",
  "wholesaler",
  "retailer",
  "other",
]);

const updateSchema = z.object({
  roles: z.array(tradingRole).min(1).max(7),
});

async function authenticatedBusiness() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await authenticatedBusiness();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("business_trading_roles")
    .select("role, is_primary")
    .eq("business_id", user.id)
    .order("is_primary", { ascending: false })
    .order("role", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Unable to load trading roles" },
      { status: error.code === "42501" ? 403 : 400 },
    );
  }

  return NextResponse.json({
    roles: (data || []).map((entry) => ({
      role: entry.role,
      isPrimary: entry.is_primary,
    })),
  });
}

export async function PUT(request: NextRequest) {
  const { supabase, user } = await authenticatedBusiness();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid trading roles" },
      { status: 400 },
    );
  }

  const roles = Array.from(new Set(parsed.data.roles));
  const { data, error } = await supabase.rpc("business_set_trading_roles", {
    p_roles: roles,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Unable to update trading roles" },
      { status: error.code === "42501" ? 403 : 400 },
    );
  }

  return NextResponse.json({ roles: data || roles });
}
