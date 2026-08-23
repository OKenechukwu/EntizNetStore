import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const categorySchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(160).nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  isAdult: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
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
    .from("categories")
    .select("id,parent_id,name,slug,description,image_url,is_adult,sort_order,is_active,created_at,updated_at")
    .order("sort_order")
    .order("name");

  if (error) {
    console.error("Unable to load categories", error);
    return NextResponse.json({ error: "Unable to load categories" }, { status: 500 });
  }

  return NextResponse.json({ categories: data ?? [] });
}

async function saveCategory(request: NextRequest) {
  const { user, errorResponse } = await requireAdmin();
  if (errorResponse || !user) return errorResponse;

  const body = await request.json().catch(() => null);
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const admin = getSupabaseAdmin();
  const { data: categoryId, error } = await admin.rpc("admin_save_category", {
    p_admin_id: user.id,
    p_category_id: input.id ?? null,
    p_name: input.name,
    p_slug: input.slug ?? null,
    p_description: input.description ?? null,
    p_parent_id: input.parentId ?? null,
    p_is_adult: input.isAdult,
    p_is_active: input.isActive,
    p_sort_order: input.sortOrder,
  });

  if (error || !categoryId) {
    return rpcErrorResponse(error ?? { message: "Category was not saved" }, "Unable to save category");
  }

  const { data: category, error: readError } = await admin
    .from("categories")
    .select("id,parent_id,name,slug,description,image_url,is_adult,sort_order,is_active,created_at,updated_at")
    .eq("id", categoryId)
    .single();

  if (readError) {
    console.error("Category saved but could not be reloaded", readError);
    return NextResponse.json({ id: categoryId }, { status: input.id ? 200 : 201 });
  }

  return NextResponse.json({ category }, { status: input.id ? 200 : 201 });
}

export async function POST(request: NextRequest) {
  return saveCategory(request);
}

export async function PUT(request: NextRequest) {
  return saveCategory(request);
}

export async function DELETE(request: NextRequest) {
  const { user, errorResponse } = await requireAdmin();
  if (errorResponse || !user) return errorResponse;

  const categoryId = new URL(request.url).searchParams.get("id");
  const parsed = z.string().uuid().safeParse(categoryId);
  if (!parsed.success) {
    return NextResponse.json({ error: "Valid category ID is required" }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin().rpc("admin_delete_category", {
    p_admin_id: user.id,
    p_category_id: parsed.data,
  });

  if (error) return rpcErrorResponse(error, "Unable to delete category");
  return NextResponse.json({ success: true });
}
