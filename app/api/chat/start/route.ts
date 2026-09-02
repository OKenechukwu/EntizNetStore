import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { logOperationalError } from "@/lib/observability/operationalEvent";

const contextSchema = z.object({
  contextType: z.enum(["product", "storefront", "order", "wholesale_offer"]),
  contextId: z.string().uuid(),
});

const legacyProductSchema = z.object({
  productId: z.string().uuid(),
  // sellerId is intentionally not part of the authority decision. Older
  // clients may still send it, but the database derives the counterparty from
  // the product itself.
  sellerId: z.string().uuid().optional(),
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

  const body = await request.json().catch(() => null);
  const canonical = contextSchema.safeParse(body);
  const legacyProduct = canonical.success ? null : legacyProductSchema.safeParse(body);

  const context = canonical.success
    ? canonical.data
    : legacyProduct?.success
      ? { contextType: "product" as const, contextId: legacyProduct.data.productId }
      : null;

  if (!context) {
    return NextResponse.json({ error: "A valid marketplace conversation context is required" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("open_store_conversation", {
    p_context_type: context.contextType,
    p_context_id: context.contextId,
  });

  if (error || !data) {
    const message = error?.message || "Unable to open conversation";
    if (error?.code === "42501") {
      return NextResponse.json({ error: "Conversation unavailable for this account" }, { status: 403 });
    }
    if (error?.code === "28000") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.code === "22023") {
      return NextResponse.json({ error: "Conversation context is not available" }, { status: 404 });
    }

    logOperationalError("store_chat_open_failed", error || new Error(message), {
      component: "messaging",
      operation: "open-store-conversation",
      route: "/api/chat/start",
      actorId: user.id,
      recordId: context.contextId,
      metadata: { contextType: context.contextType },
    });
    return NextResponse.json({ error: "Unable to open conversation" }, { status: 500 });
  }

  return NextResponse.json({
    conversationId: data,
    // Transitional alias for any old product surface still reading threadId.
    threadId: data,
  });
}
