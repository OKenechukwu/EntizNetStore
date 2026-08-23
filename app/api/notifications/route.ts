import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const markSchema = z.union([
  z.object({ notificationId: z.string().uuid() }),
  z.object({ all: z.literal(true) }),
]);

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, message, read, action_url, metadata, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Unable to load notifications", error);
    return NextResponse.json({ error: "Unable to load notifications" }, { status: 500 });
  }

  const notifications = data ?? [];
  return NextResponse.json({
    notifications,
    unreadCount: notifications.filter((notification) => !notification.read).length,
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = markSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid notification action" }, { status: 400 });
  }

  if ("all" in parsed.data) {
    const { data, error } = await supabase.rpc("mark_all_notifications_read");
    if (error) {
      return NextResponse.json(
        { error: error.message || "Unable to mark notifications read" },
        { status: error.code === "42501" ? 403 : 400 },
      );
    }
    return NextResponse.json({ ok: true, markedCount: Number(data ?? 0) });
  }

  const { error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: parsed.data.notificationId,
  });
  if (error) {
    return NextResponse.json(
      { error: error.message || "Unable to mark notification read" },
      { status: error.code === "42501" ? 403 : 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
