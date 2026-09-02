import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  decryptConversationMessage,
  getConversationDataKey,
  MESSAGE_ENCRYPTION_VERSION,
} from "@/lib/messaging/messageCrypto";
import {
  resolveMarketplaceConversationIdentities,
  type MarketplaceConversationRole,
} from "@/lib/messaging/marketplaceIdentity";
import { logOperationalError } from "@/lib/observability/operationalEvent";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MESSAGES = 500;

type ConversationRow = {
  id: string;
  subject: string | null;
  participant1_id: string;
  participant2_id: string;
  participant1_role: MarketplaceConversationRole;
  participant2_role: MarketplaceConversationRole;
  context_type: "product" | "storefront" | "order" | "wholesale_offer";
  context_id: string;
  status: "active" | "closed";
};

type AttachmentRow = {
  id: string;
  message_id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  message_type: string | null;
  is_encrypted: boolean | null;
  encryption_iv: string | null;
  encryption_version: string | null;
  read_at: string | null;
  created_at: string;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId } = await params;
  if (!UUID_RE.test(conversationId)) {
    return NextResponse.json({ error: "Invalid conversation" }, { status: 400 });
  }

  const { data: conversationData, error: conversationError } = await supabase
    .from("conversations")
    .select(
      "id, subject, participant1_id, participant2_id, participant1_role, participant2_role, context_type, context_id, status",
    )
    .eq("id", conversationId)
    .neq("context_type", "legacy")
    .maybeSingle();

  if (conversationError) {
    logOperationalError("store_chat_detail_lookup_failed", conversationError, {
      component: "messaging",
      operation: "load-conversation",
      route: "/api/messages/conversations/[conversationId]",
      actorId: user.id,
      recordId: conversationId,
    });
    return NextResponse.json({ error: "Unable to load conversation" }, { status: 500 });
  }
  if (!conversationData) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const conversation = conversationData as ConversationRow;
  const actorIsP1 = conversation.participant1_id === user.id;
  const otherUserId = actorIsP1 ? conversation.participant2_id : conversation.participant1_id;
  const otherRole = actorIsP1 ? conversation.participant2_role : conversation.participant1_role;

  const { data: messageData, error: messagesError } = await supabase
    .from("messages")
    .select(
      "id, conversation_id, sender_id, recipient_id, content, message_type, is_encrypted, encryption_iv, encryption_version, read_at, created_at",
    )
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(MAX_MESSAGES);

  if (messagesError) {
    logOperationalError("store_chat_message_query_failed", messagesError, {
      component: "messaging",
      operation: "load-conversation-messages",
      route: "/api/messages/conversations/[conversationId]",
      actorId: user.id,
      recordId: conversationId,
    });
    return NextResponse.json({ error: "Unable to load messages" }, { status: 500 });
  }

  const messages = (messageData ?? []) as MessageRow[];
  const messageIds = messages.map((message) => message.id);
  let attachments: AttachmentRow[] = [];

  if (messageIds.length) {
    const { data: attachmentData, error: attachmentError } = await supabase
      .from("message_attachments")
      .select("id, message_id, file_name, file_size, mime_type, created_at")
      .in("message_id", messageIds)
      .order("created_at", { ascending: true });
    if (attachmentError) {
      logOperationalError("store_chat_attachment_query_failed", attachmentError, {
        component: "messaging",
        operation: "load-message-attachments",
        route: "/api/messages/conversations/[conversationId]",
        actorId: user.id,
        recordId: conversationId,
      });
      return NextResponse.json({ error: "Unable to load message attachments" }, { status: 500 });
    }
    attachments = (attachmentData ?? []) as AttachmentRow[];
  }

  const attachmentsByMessage = new Map<string, AttachmentRow[]>();
  for (const attachment of attachments) {
    const current = attachmentsByMessage.get(attachment.message_id) ?? [];
    current.push(attachment);
    attachmentsByMessage.set(attachment.message_id, current);
  }

  let dataKey: Buffer | null = null;
  if (messages.some((message) => message.is_encrypted)) {
    try {
      dataKey = await getConversationDataKey(conversation.id);
    } catch (keyError) {
      logOperationalError("store_chat_key_unwrap_failed", keyError, {
        component: "messaging",
        operation: "unwrap-conversation-key",
        route: "/api/messages/conversations/[conversationId]",
        actorId: user.id,
        recordId: conversationId,
      });
    }
  }

  const decrypted = messages.map((message) => {
    let content = "Encrypted message unavailable";
    if (
      message.is_encrypted &&
      message.encryption_version === MESSAGE_ENCRYPTION_VERSION &&
      message.encryption_iv &&
      dataKey
    ) {
      try {
        content = decryptConversationMessage(
          conversation.id,
          message.content,
          message.encryption_iv,
          dataKey,
        );
      } catch (decryptError) {
        logOperationalError("store_chat_message_decrypt_failed", decryptError, {
          component: "messaging",
          operation: "decrypt-message",
          route: "/api/messages/conversations/[conversationId]",
          actorId: user.id,
          recordId: message.id,
        });
      }
    }

    return {
      id: message.id,
      conversationId: message.conversation_id,
      senderId: message.sender_id,
      recipientId: message.recipient_id,
      content,
      messageType: message.message_type ?? "text",
      createdAt: message.created_at,
      readAt: message.read_at,
      attachments: attachmentsByMessage.get(message.id) ?? [],
    };
  });

  const { error: readError } = await supabase.rpc("mark_store_conversation_read", {
    p_conversation_id: conversation.id,
  });
  if (readError && readError.code !== "42501") {
    logOperationalError("store_chat_mark_read_failed", readError, {
      component: "messaging",
      operation: "mark-conversation-read",
      route: "/api/messages/conversations/[conversationId]",
      actorId: user.id,
      recordId: conversationId,
    });
  }

  let counterpart;
  try {
    const identities = await resolveMarketplaceConversationIdentities([
      { id: otherUserId, role: otherRole },
    ]);
    counterpart =
      identities.get(otherUserId) ?? {
        id: otherUserId,
        role: otherRole,
        displayName: "Marketplace member",
        kind: "shopper",
        logoUrl: null,
        storeSlug: null,
        businessKind: null,
      };
  } catch (identityError) {
    logOperationalError("store_chat_detail_identity_failed", identityError, {
      component: "messaging",
      operation: "resolve-conversation-identity",
      route: "/api/messages/conversations/[conversationId]",
      actorId: user.id,
      recordId: conversationId,
    });
    counterpart = {
      id: otherUserId,
      role: otherRole,
      displayName: "Marketplace member",
      kind: "shopper",
      logoUrl: null,
      storeSlug: null,
      businessKind: null,
    };
  }

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      subject: conversation.subject,
      status: conversation.status,
      context: { type: conversation.context_type, id: conversation.context_id },
      counterpart,
    },
    messages: decrypted,
  });
}
