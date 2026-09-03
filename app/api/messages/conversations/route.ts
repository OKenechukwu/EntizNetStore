import { NextResponse } from "next/server";
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

const MAX_CONVERSATIONS = 100;
const MAX_MESSAGE_WINDOW = 2000;

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
  last_message_at: string | null;
  updated_at: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_encrypted: boolean | null;
  encryption_iv: string | null;
  encryption_version: string | null;
  read_at: string | null;
  created_at: string;
};

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, subject, participant1_id, participant2_id, participant1_role, participant2_role, context_type, context_id, status, last_message_at, updated_at",
    )
    .neq("context_type", "legacy")
    .order("last_message_at", { ascending: false })
    .limit(MAX_CONVERSATIONS);

  if (error) {
    logOperationalError("store_chat_list_failed", error, {
      component: "messaging",
      operation: "list-conversations",
      route: "/api/messages/conversations",
      actorId: user.id,
    });
    return NextResponse.json({ error: "Unable to load conversations" }, { status: 500 });
  }

  const conversations = (data ?? []) as ConversationRow[];
  if (!conversations.length) {
    return NextResponse.json({ conversations: [] });
  }

  const conversationIds = conversations.map((conversation) => conversation.id);
  const { data: messageData, error: messageError } = await supabase
    .from("messages")
    .select(
      "id, conversation_id, sender_id, recipient_id, content, is_encrypted, encryption_iv, encryption_version, read_at, created_at",
    )
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false })
    .limit(MAX_MESSAGE_WINDOW);

  if (messageError) {
    logOperationalError("store_chat_preview_query_failed", messageError, {
      component: "messaging",
      operation: "load-conversation-previews",
      route: "/api/messages/conversations",
      actorId: user.id,
    });
    return NextResponse.json({ error: "Unable to load conversation previews" }, { status: 500 });
  }

  const latest = new Map<string, MessageRow>();
  const unread = new Map<string, number>();
  for (const message of (messageData ?? []) as MessageRow[]) {
    if (!latest.has(message.conversation_id)) latest.set(message.conversation_id, message);
    if (message.recipient_id === user.id && !message.read_at) {
      unread.set(message.conversation_id, (unread.get(message.conversation_id) ?? 0) + 1);
    }
  }

  const identityRequests = conversations.map((conversation) => {
    const actorIsP1 = conversation.participant1_id === user.id;
    return {
      id: actorIsP1 ? conversation.participant2_id : conversation.participant1_id,
      role: actorIsP1 ? conversation.participant2_role : conversation.participant1_role,
    };
  });

  let identities;
  try {
    identities = await resolveMarketplaceConversationIdentities(identityRequests);
  } catch (identityError) {
    logOperationalError("store_chat_identity_resolution_failed", identityError, {
      component: "messaging",
      operation: "resolve-conversation-identities",
      route: "/api/messages/conversations",
      actorId: user.id,
    });
    return NextResponse.json({ error: "Unable to load conversation identities" }, { status: 500 });
  }

  const response = await Promise.all(
    conversations.map(async (conversation) => {
      const actorIsP1 = conversation.participant1_id === user.id;
      const otherUserId = actorIsP1 ? conversation.participant2_id : conversation.participant1_id;
      const otherRole = actorIsP1 ? conversation.participant2_role : conversation.participant1_role;
      const last = latest.get(conversation.id) ?? null;
      let preview = last ? "Encrypted message" : "No messages yet";

      if (
        last?.is_encrypted &&
        last.encryption_version === MESSAGE_ENCRYPTION_VERSION &&
        last.encryption_iv
      ) {
        try {
          const dataKey = await getConversationDataKey(conversation.id);
          if (dataKey) {
            preview = decryptConversationMessage(
              conversation.id,
              last.content,
              last.encryption_iv,
              dataKey,
            );
          }
        } catch (decryptError) {
          logOperationalError("store_chat_preview_decrypt_failed", decryptError, {
            component: "messaging",
            operation: "decrypt-conversation-preview",
            route: "/api/messages/conversations",
            actorId: user.id,
            recordId: conversation.id,
          });
        }
      }

      return {
        id: conversation.id,
        subject: conversation.subject,
        status: conversation.status,
        context: {
          type: conversation.context_type,
          id: conversation.context_id,
        },
        counterpart:
          identities.get(otherUserId) ?? {
            id: otherUserId,
            role: otherRole,
            displayName: "Marketplace member",
            kind: "shopper",
            logoUrl: null,
            storeSlug: null,
            businessKind: null,
          },
        lastMessage: last
          ? {
              id: last.id,
              content: preview,
              createdAt: last.created_at,
              fromMe: last.sender_id === user.id,
            }
          : null,
        unreadCount: unread.get(conversation.id) ?? 0,
        updatedAt: conversation.last_message_at ?? conversation.updated_at,
      };
    }),
  );

  return NextResponse.json({ conversations: response });
}
