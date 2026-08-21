// app/api/chat/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { text, threadId, recipientId } = await req.json();

    if (!text?.trim() || !threadId || !recipientId) {
      return NextResponse.json(
        { error: "text, threadId and recipientId are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        recipient_id: recipientId,
        content: text.trim(),
        conversation_id: threadId,
      })
      .select("id, content")
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      messageId: message.id,
      original: text.trim(),
      translated: message.content,
    });
  } catch (error) {
    console.error("Failed to send message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
