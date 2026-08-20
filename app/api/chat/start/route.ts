// app/api/chat/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

/**
 * POST /api/chat/start
 * Creates or opens a chat thread with a seller
 * Body: { sellerId, productId }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sellerId, productId } = body;

    if (!sellerId) {
      return NextResponse.json({ error: "Seller ID required" }, { status: 400 });
    }

    const supabase = createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (sellerId === user.id) {
      return NextResponse.json(
        { error: "You cannot start a conversation with yourself" },
        { status: 400 }
      );
    }

    const { data: seller } = await supabase
      .from("profiles_seller")
      .select("id")
      .eq("id", sellerId)
      .eq("verification_status", "verified")
      .maybeSingle();
    if (!seller) {
      return NextResponse.json(
        { error: "Verified seller not found" },
        { status: 404 }
      );
    }

    // Reuse an existing two-party conversation when possible.
    const { data: existingThread } = await supabase
      .from("conversations")
      .select("id")
      .contains("participants", [user.id, sellerId])
      .eq("type", "product_inquiry")
      .limit(1)
      .maybeSingle();

    if (existingThread) {
      return NextResponse.json({ threadId: existingThread.id });
    }

    // Create new thread
    const { data: newThread, error } = await supabase
      .from("conversations")
      .insert({
        type: "product_inquiry",
        participants: [user.id, sellerId],
        subject: "Product inquiry",
        metadata: productId ? { product_id: productId } : {},
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create chat thread:", error);
      return NextResponse.json(
        { error: "Failed to create chat thread" },
        { status: 500 }
      );
    }

    return NextResponse.json({ threadId: newThread.id });
  } catch (error) {
    console.error("Chat start error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
