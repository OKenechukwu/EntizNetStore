import { NextResponse } from "next/server";
import { z } from "zod";
import { reportOperationalError } from "@/lib/observability/operationalEventSink";
import {
  decryptConversationMessage,
  getConversationDataKey,
} from "@/lib/messaging/messageCrypto";
import { messageTranslationLaunchStatus } from "@/lib/launch/messagingReadiness";
import { translateAuthorizedMessage } from "@/lib/messaging/messageTranslation";
import { normalizeTranslationLanguage } from "@/lib/messaging/messageTranslationProviderCore";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.object({
  messageId: z.string().uuid(),
  targetLanguage: z.string().trim().min(2).max(35),
});

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: responseHeaders });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return json({ error: "Authentication required" }, 401);

  const payload = requestSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) return json({ error: "Invalid translation request" }, 400);

  const targetLanguage = normalizeTranslationLanguage(payload.data.targetLanguage);
  if (!targetLanguage) return json({ error: "Invalid target language" }, 400);

  if (messageTranslationLaunchStatus() !== "configured") {
    return json({ error: "Message translation is not available" }, 503);
  }

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .select(
      "id,conversation_id,content,is_encrypted,encryption_iv,encryption_version",
    )
    .eq("id", payload.data.messageId)
    .maybeSingle();

  if (messageError) {
    await reportOperationalError("message_translation.authorized_read_failed", messageError, {
      component: "messaging",
      operation: "translation-authorized-message-read",
      route: "/api/messages/translate",
      actorId: user.id,
    });
    return json({ error: "Unable to translate message" }, 503);
  }

  if (!message || !message.conversation_id) {
    return json({ error: "Message not found" }, 404);
  }

  if (
    message.is_encrypted !== true ||
    typeof message.content !== "string" ||
    typeof message.encryption_iv !== "string" ||
    typeof message.encryption_version !== "string"
  ) {
    await reportOperationalError(
      "message_translation.canonical_ciphertext_invalid",
      "canonical message is not encrypted with a supported persisted shape",
      {
        component: "messaging",
        operation: "translation-canonical-ciphertext-check",
        route: "/api/messages/translate",
        actorId: user.id,
      },
    );
    return json({ error: "Unable to translate message" }, 503);
  }

  let dataKey: Buffer;
  let originalText: string;
  try {
    const resolvedKey = await getConversationDataKey(message.conversation_id);
    if (!resolvedKey) throw new Error("conversation key unavailable");
    dataKey = resolvedKey;
    originalText = decryptConversationMessage(
      message.conversation_id,
      message.content,
      message.encryption_iv,
      dataKey,
    );
  } catch (error) {
    await reportOperationalError("message_translation.canonical_decryption_failed", error, {
      component: "messaging",
      operation: "translation-canonical-decryption",
      route: "/api/messages/translate",
      actorId: user.id,
    });
    return json({ error: "Unable to translate message" }, 503);
  }

  const result = await translateAuthorizedMessage(
    {
      messageId: message.id,
      conversationId: message.conversation_id,
      plaintext: originalText,
      originalEncryptionVersion: message.encryption_version,
    },
    dataKey,
    targetLanguage,
  );

  if (!result.ok) {
    if (result.code === "message_translation_pending") {
      return json({ status: "pending" }, 202);
    }

    await reportOperationalError(`message_translation.${result.code}`, result.code, {
      component: "messaging",
      operation: "translate-message",
      route: "/api/messages/translate",
      actorId: user.id,
      recordId: message.id,
    });
    return json({ error: "Message translation is temporarily unavailable" }, 503);
  }

  return json(
    {
      translation: {
        messageId: message.id,
        translatedText: result.translatedText,
        sourceLanguage: result.sourceLanguage,
        targetLanguage: result.targetLanguage,
        provider: result.provider,
        providerVersion: result.providerVersion,
        translatedAt: result.translatedAt,
        cached: result.cached,
      },
    },
    200,
  );
}
