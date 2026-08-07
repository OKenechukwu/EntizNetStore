// app/api/chat/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// Persists chat messages in the live Neon database (messages table).
export async function POST(req: NextRequest) {
  try {
    const { text, threadId, senderId, recipientId } = await req.json();

    if (!text || !senderId || !recipientId) {
      return NextResponse.json(
        { error: "text, senderId and recipientId are required" },
        { status: 400 }
      );
    }

    const rows = await query<{ id: string }>(
      `INSERT INTO messages (sender_id, recipient_id, content, conversation_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [senderId, recipientId, text, threadId ?? null]
    );

    return NextResponse.json({ ok: true, messageId: rows[0]?.id });
  } catch (error) {
    console.error("Failed to send message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
