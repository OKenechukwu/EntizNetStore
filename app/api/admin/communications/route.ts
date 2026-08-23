import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const contentSchema = z.object({
  action: z.literal("saveContent"),
  pageId: z.string().uuid().nullable().optional(),
  pageKey: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(240),
  content: z.string().max(200000).nullable().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
  isActive: z.boolean().default(true),
});

const notificationSchema = z.object({
  action: z.literal("sendNotification"),
  userId: z.string().uuid(),
  type: z.enum(["message", "order", "promo", "system", "payment", "shipping"]),
  title: z.string().trim().min(1).max(240),
  message: z.string().trim().min(1).max(10000),
  actionUrl: z.string().trim().max(1000).nullable().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
});

const actionSchema = z.discriminatedUnion("action", [contentSchema, notificationSchema]);

export async function GET() {
  const { user, errorResponse } = await requireAdmin();
  if (errorResponse || !user) return errorResponse;

  const admin = getSupabaseAdmin();
  const [pagesResult, notificationsResult, accountsResult] = await Promise.all([
    admin
      .from("content_pages")
      .select("id, page_key, title, content, metadata, is_active, created_at, updated_at")
      .eq("marketplace_brand", "entiznetstore")
      .order("page_key"),
    admin
      .from("notifications")
      .select("id, user_id, type, title, message, read, action_url, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    admin.rpc("admin_search_marketplace_accounts", {
      p_admin_id: user.id,
      p_query: "",
      p_capability: "all",
      p_status: "all",
      p_limit: 100,
      p_offset: 0,
    }),
  ]);

  if (pagesResult.error || notificationsResult.error || accountsResult.error) {
    console.error("Unable to load communications operations", {
      pages: pagesResult.error,
      notifications: notificationsResult.error,
      accounts: accountsResult.error,
    });
    return NextResponse.json({ error: "Unable to load communications operations" }, { status: 500 });
  }

  return NextResponse.json({
    pages: pagesResult.data ?? [],
    notifications: notificationsResult.data ?? [],
    accounts: accountsResult.data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const { user, errorResponse } = await requireAdmin();
  if (errorResponse || !user) return errorResponse;

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid communications action" },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  if (parsed.data.action === "saveContent") {
    const input = parsed.data;
    const { data, error } = await admin.rpc("admin_save_content_page", {
      p_admin_id: user.id,
      p_page_id: input.pageId ?? null,
      p_page_key: input.pageKey,
      p_title: input.title,
      p_content: input.content ?? null,
      p_metadata: input.metadata,
      p_is_active: input.isActive,
    });
    if (error) {
      return NextResponse.json(
        { error: error.message || "Unable to save content page" },
        { status: error.code === "23505" ? 409 : error.code === "42501" ? 403 : 400 },
      );
    }
    return NextResponse.json({ ok: true, pageId: data });
  }

  const input = parsed.data;
  const { data, error } = await admin.rpc("admin_send_notification", {
    p_admin_id: user.id,
    p_user_id: input.userId,
    p_type: input.type,
    p_title: input.title,
    p_message: input.message,
    p_action_url: input.actionUrl || null,
    p_metadata: input.metadata,
  });
  if (error) {
    return NextResponse.json(
      { error: error.message || "Unable to send notification" },
      { status: error.code === "42501" ? 403 : 400 },
    );
  }

  return NextResponse.json({ ok: true, notificationId: data });
}
