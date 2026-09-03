import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { sanitizeInput } from "@/lib/security";
import {
  encryptConversationMessage,
  getOrCreateConversationDataKey,
} from "@/lib/messaging/messageCrypto";
import { logOperationalError } from "@/lib/observability/operationalEvent";

const sendSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().max(12000),
  messageType: z.literal("text").optional().default("text"),
});

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = sendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid conversation and message are required" }, { status: 400 });
  }

  const content = sanitizeInput(parsed.data.content).slice(0, 10000);
  if (!content) {
    return NextResponse.json({ error: "Message content cannot be empty" }, { status: 400 });
  }

  // RLS membership proof happens before any privileged key-envelope access.
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", parsed.data.conversationId)
    .eq("status", "active")
    .neq("context_type", "legacy")
    .maybeSingle();

  if (conversationError) {
    logOperationalError("store_chat_membership_lookup_failed", conversationError, {
      component: "messaging",
      operation: "send-membership-lookup",
      route: "/api/messages/send",
      actorId: user.id,
      recordId: parsed.data.conversationId,
    });
    return NextResponse.json({ error: "Unable to open secure conversation" }, { status: 500 });
  }
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  try {
    const dataKey = await getOrCreateConversationDataKey(conversation.id);
    const encrypted = encryptConversationMessage(conversation.id, content, dataKey);

    const { data: messageId, error } = await supabase.rpc("send_store_message", {
      p_conversation_id: conversation.id,
      p_ciphertext: encrypted.ciphertext,
      p_iv: encrypted.iv,
      p_encryption_version: encrypted.encryptionVersion,
      p_message_type: parsed.data.messageType,
    });

    if (error || !messageId) {
      if (error?.message?.includes("message_rate_limited")) {
        return NextResponse.json({ error: "Message rate limit reached. Try again shortly." }, { status: 429 });
      }
      if (error?.code === "42501") {
        return NextResponse.json({ error: "Conversation sending is not available for this account" }, { status: 403 });
      }
      if (error?.code === "22023") {
        return NextResponse.json({ error: "Invalid encrypted message" }, { status: 400 });
      }

      logOperationalError("store_chat_send_failed", error || new Error("missing message id"), {
        component: "messaging",
        operation: "send-store-message",
        route: "/api/messages/send",
        actorId: user.id,
        recordId: conversation.id,
      });
      return NextResponse.json({ error: "Unable to send message" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: {
        id: messageId,
        conversation_id: conversation.id,
        sender_id: user.id,
        content,
        message_type: "text",
        is_encrypted: true,
        encryption_version: encrypted.encryptionVersion,
        attachments: [],
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    logOperationalError("store_chat_crypto_failed", error, {
      component: "messaging",
      operation: "message-crypto",
      route: "/api/messages/send",
      actorId: user.id,
      recordId: conversation.id,
    });
    return NextResponse.json({ error: "Unable to open secure conversation" }, { status: 500 });
  }
}
