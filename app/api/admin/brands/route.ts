import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const brandSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(160).nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  logoUrl: z.string().url().max(2000).nullable().optional().or(z.literal("")),
  bannerUrl: z.string().url().max(2000).nullable().optional().or(z.literal("")),
  website: z.string().url().max(2000).nullable().optional().or(z.literal("")),
  isVerified: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

function rpcErrorResponse(error: { code?: string; message?: string }, fallback: string) {
  if (error.code === "23505" || error.code === "23503") {
    return NextResponse.json({ error: error.message || fallback }, { status: 409 });
  }
  if (error.code === "22023") {
    return NextResponse.json({ error: error.message || fallback }, { status: 400 });
  }
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET() {
  const { user, errorResponse } = await requireAdmin();
  if (errorResponse || !user) return errorResponse;

  const { data, error } = await getSupabaseAdmin()
    .from("brands")
    .select("id,name,slug,description,logo_url,banner_url,website,is_verified,is_active,created_at,updated_at")
    .order("name");

  if (error) {
    console.error("Unable to load brands", error);
    return NextResponse.json({ error: "Unable to load brands" }, { status: 500 });
  }

  return NextResponse.json({ brands: data ?? [] });
}

async function saveBrand(request: NextRequest) {
  const { user, errorResponse } = await requireAdmin();
  if (errorResponse || !user) return errorResponse;

  const body = await request.json().catch(() => null);
  const parsed = brandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid brand payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const admin = getSupabaseAdmin();
  const { data: brandId, error } = await admin.rpc("admin_save_brand", {
    p_admin_id: user.id,
    p_brand_id: input.id ?? null,
    p_name: input.name,
    p_slug: input.slug ?? null,
    p_description: input.description ?? null,
    p_logo_url: input.logoUrl || null,
    p_banner_url: input.bannerUrl || null,
    p_website: input.website || null,
    p_is_verified: input.isVerified,
    p_is_active: input.isActive,
  });

  if (error || !brandId) {
    return rpcErrorResponse(error ?? { message: "Brand was not saved" }, "Unable to save brand");
  }

  const { data: brand, error: readError } = await admin
    .from("brands")
    .select("id,name,slug,description,logo_url,banner_url,website,is_verified,is_active,created_at,updated_at")
    .eq("id", brandId)
    .single();

  if (readError) {
    console.error("Brand saved but could not be reloaded", readError);
    return NextResponse.json({ id: brandId }, { status: input.id ? 200 : 201 });
  }

  return NextResponse.json({ brand }, { status: input.id ? 200 : 201 });
}

export async function POST(request: NextRequest) {
  return saveBrand(request);
}

export async function PUT(request: NextRequest) {
  return saveBrand(request);
}

export async function DELETE(request: NextRequest) {
  const { user, errorResponse } = await requireAdmin();
  if (errorResponse || !user) return errorResponse;

  const brandId = new URL(request.url).searchParams.get("id");
  const parsed = z.string().uuid().safeParse(brandId);
  if (!parsed.success) {
    return NextResponse.json({ error: "Valid brand ID is required" }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin().rpc("admin_delete_brand", {
    p_admin_id: user.id,
    p_brand_id: parsed.data,
  });

  if (error) return rpcErrorResponse(error, "Unable to delete brand");
  return NextResponse.json({ success: true });
}
