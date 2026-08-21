import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

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

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe checkout is not configured");
  return new Stripe(key);
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid checkout" }, { status: 400 });
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

  const { data: checkoutRows, error: checkoutError } = await supabase.rpc("create_checkout_session", {
    p_items: input.items,
    p_shipping_address: address,
    p_idempotency_key: input.idempotencyKey,
  });
  if (checkoutError || !checkoutRows?.[0]) {
    return NextResponse.json({ error: checkoutError?.message || "Unable to create checkout" }, { status: 400 });
  }

  const checkout = checkoutRows[0];
  try {
    const paymentIntent = await stripeClient().paymentIntents.create({
      amount: Number(checkout.amount_cents),
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      receipt_email: user.email,
      metadata: {
        checkout_session_id: checkout.session_id,
        buyer_id: user.id,
        marketplace_brand: "entiznetstore",
      },
      shipping: input.shippingAddress ? {
        name: input.shippingAddress.name,
        address: {
          line1: input.shippingAddress.line1,
          line2: input.shippingAddress.line2,
          city: input.shippingAddress.city,
          state: input.shippingAddress.state,
          postal_code: input.shippingAddress.postalCode,
          country: input.shippingAddress.country,
        },
      } : undefined,
    }, { idempotencyKey: checkout.session_id });

    const { error: attachError } = await supabase.rpc("attach_checkout_payment_intent", {
      p_session_id: checkout.session_id,
      p_payment_intent_id: paymentIntent.id,
    });
    if (attachError) throw attachError;

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      checkoutSessionId: checkout.session_id,
      amountCents: Number(checkout.amount_cents),
      currency: "usd",
    });
  } catch (error) {
    await supabase.rpc("cancel_checkout_session", { p_session_id: checkout.session_id });
    console.error("Payment intent creation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to initialize payment" },
      { status: 503 },
    );
  }
}
