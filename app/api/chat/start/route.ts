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

    // Check if thread already exists between this user and seller
    const { data: existingThread } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("buyer_id", user.id)
      .eq("seller_id", sellerId)
      .single();

    if (existingThread) {
      return NextResponse.json({ threadId: existingThread.id });
    }

    // Create new thread
    const { data: newThread, error } = await supabase
      .from("chat_threads")
      .insert({
        buyer_id: user.id,
        seller_id: sellerId,
        product_id: productId || null,
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
