// app/api/chat/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { translate } from "@/lib/i18n/translate";
import { db } from "@/lib/db"; // your DB client
import { getUserPreferredLang } from "@/lib/user-prefs"; // implement this

export async function POST(req: NextRequest) {
  const { text, threadId, senderId, recipientId, sourceLang } =
    await req.json();

  const recipientLang = await getUserPreferredLang(recipientId); // e.g., "fr"
  let translatedText = text;

  if (recipientLang && recipientLang !== sourceLang) {
    translatedText = await translate(text, recipientLang, {
      formality: "default",
    });
  }

  // 1) Save original
  const msg = await db.message.create({
    data: { threadId, senderId, text, sourceLang },
  });

  // 2) Cache translation (optional but ideal for speed)
  if (translatedText !== text) {
    await db.messageTranslation.create({
      data: {
        messageId: msg.id,
        lang: recipientLang,
        text: translatedText,
        provider: "deepl",
      },
    });
  }

  // 3) Notify recipient (realtime / socket / supabase)
  // publish({ threadId, message: { ...msg, textForRecipient: translatedText } });

  return NextResponse.json({ ok: true, messageId: msg.id });
}
