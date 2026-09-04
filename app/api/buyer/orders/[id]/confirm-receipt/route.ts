import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

const inputSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
  })
  .strict();

const publicValidationMessages: Record<string, string> = {
  delivered_paid_order_required: "Receipt can be confirmed only after the order is paid and marked delivered.",
  active_order_dispute_blocks_settlement: "Resolve the active order dispute before confirming receipt.",
  active_refund_blocks_settlement: "Resolve the active refund request before confirming receipt.",
};

function noStoreJson(body: Record<string, unknown>, status: number, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      ...extraHeaders,
    },
  });
}

function confirmationError(error: { code?: string; message?: string }) {
  if (error.code === "PGRST202" || error.code === "42883") {
    return noStoreJson(
      {
        error: "Receipt confirmation is temporarily unavailable. Please refresh shortly.",
        code: "settlement_authority_unavailable",
      },
      503,
      { "Retry-After": "5" },
    );
  }
  if (error.code === "28000") {
    return noStoreJson({ error: "Authentication required", code: "authentication_required" }, 401);
  }
  if (error.code === "42501") {
    return noStoreJson({ error: "Order not found", code: "order_not_found" }, 404);
  }
  if (error.code === "22023") {
    const candidate = typeof error.message === "string" ? error.message : "";
    const code = Object.hasOwn(publicValidationMessages, candidate)
      ? candidate
      : "invalid_receipt_confirmation";
    return noStoreJson(
      {
        error: publicValidationMessages[code] ?? "Receipt confirmation is not available for this order.",
        code,
      },
      409,
    );
  }
  return noStoreJson(
    { error: "Unable to confirm receipt", code: "receipt_confirmation_failed" },
    500,
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const orderId = z.string().uuid().safeParse(id);
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!orderId.success || !input.success) {
    return noStoreJson({ error: "Invalid receipt confirmation", code: "invalid_request" }, 400);
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return noStoreJson({ error: "Authentication required", code: "authentication_required" }, 401);
  }

  // Identity and financial authority are derived from auth.uid() plus the canonical Order.
  // The request body carries only retry identity; no counterparty or money-state authority.
  const { data, error } = await supabase.rpc("confirm_buyer_order_receipt", {
    p_order_id: orderId.data,
    p_idempotency_key: input.data.idempotencyKey,
  });

  if (error) return confirmationError(error);
  if (!data) {
    return noStoreJson(
      { error: "Unable to confirm receipt", code: "missing_authoritative_result" },
      500,
    );
  }

  return noStoreJson({ ok: true, orderId: data }, 200);
}