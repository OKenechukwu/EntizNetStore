import { NextResponse } from "next/server";

/**
 * Retired legacy endpoint.
 *
 * Conversations are no longer addressed by another user's UUID. Use
 * /api/messages/conversations/[conversationId], where membership is enforced by
 * RLS and the counterparty was derived from an authoritative commerce context.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: "User-addressed conversations have been retired.",
      code: "legacy_user_conversation_retired",
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
