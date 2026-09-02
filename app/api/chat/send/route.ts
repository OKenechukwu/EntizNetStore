import { NextResponse } from "next/server";

/**
 * Retired legacy endpoint.
 *
 * This route previously accepted a caller-supplied recipientId and inserted
 * plaintext message content directly into public.messages. Canonical Store Chat
 * now uses POST /api/messages/send with a database-authorized conversationId.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Legacy chat sending has been retired. Open a marketplace conversation before sending.",
      code: "legacy_chat_send_retired",
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
