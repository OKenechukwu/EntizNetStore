import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  getPaymentProvider,
  PaymentProviderUnavailableError,
} from "@/lib/payments/provider";

const requestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().nullable().optional(),
    quantity: z.number().int().min(1).max(100),
  })).min(1).max(100),
  shippingAddress: z.object({
    name: z.string().trim().min(2).max(200),
    line1: z.string().trim().min(2).max(200),
    line2: z.string().trim().max(200).optional(),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().max(100).optional(),
    postalCode: z.string().trim().min(1).max(30),
    country: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  }).nullable(),
});

export async function POST(request: NextRequest) {
  const provider = getPaymentProvider();
  if (!provider.configured) {
    return NextResponse.json(
      {
        error: "Payment processing is pending processor onboarding",
        code: "PAYMENT_PROVIDER_UNAVAILABLE",
      },
      { status: 503 },
    );
  }

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid checkout" },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const address = input.shippingAddress ? {
    name: input.shippingAddress.name,
    line1: input.shippingAddress.line1,
    line2: input.shippingAddress.line2 || null,
    city: input.shippingAddress.city,
    state: input.shippingAddress.state || null,
    postal_code: input.shippingAddress.postalCode,
    country: input.shippingAddress.country,
  } : null;

  const { data: checkoutRows, error: checkoutError } = await supabase.rpc(
    "create_checkout_session",
    {
      p_items: input.items,
      p_shipping_address: address,
      p_idempotency_key: input.idempotencyKey,
    },
  );

  if (checkoutError || !checkoutRows?.[0]) {
    return NextResponse.json(
      { error: checkoutError?.message || "Unable to create checkout" },
      { status: 400 },
    );
  }

  const checkout = checkoutRows[0];

  try {
    const initialized = await provider.initializePayment({
      checkoutSessionId: checkout.session_id,
      amountCents: Number(checkout.amount_cents),
      currency: "usd",
      buyerId: user.id,
      buyerEmail: user.email,
      shippingAddress: input.shippingAddress ? {
        name: input.shippingAddress.name,
        line1: input.shippingAddress.line1,
        line2: input.shippingAddress.line2 || null,
        city: input.shippingAddress.city,
        state: input.shippingAddress.state || null,
        postalCode: input.shippingAddress.postalCode,
        country: input.shippingAddress.country,
      } : null,
    });

    const { error: attachError } = await supabase.rpc(
      "attach_checkout_payment_reference",
      {
        p_session_id: checkout.session_id,
        p_provider: initialized.provider,
        p_provider_payment_id: initialized.providerPaymentId,
      },
    );

    if (attachError) throw attachError;

    return NextResponse.json({
      checkoutSessionId: checkout.session_id,
      amountCents: Number(checkout.amount_cents),
      currency: "usd",
      provider: initialized.provider,
      providerPaymentId: initialized.providerPaymentId,
      nextAction: initialized.nextAction,
    });
  } catch (error) {
    await supabase.rpc("cancel_checkout_session", {
      p_session_id: checkout.session_id,
    });

    if (error instanceof PaymentProviderUnavailableError) {
      return NextResponse.json(
        { error: error.message, code: "PAYMENT_PROVIDER_UNAVAILABLE" },
        { status: 503 },
      );
    }

    console.error("Payment initialization failed:", error);
    return NextResponse.json(
      { error: "Unable to initialize payment" },
      { status: 503 },
    );
  }
}
