import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  getPaymentProvider,
  PaymentProviderUnavailableError,
} from "@/lib/payments/provider";

const requestSchema = z.object({
  checkoutSessionId: z.string().uuid(),
});

type ShippingAddressSnapshot = {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  state?: string | null;
  postalCode?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

function toProviderAddress(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const address = value as ShippingAddressSnapshot;
  const line1 = address.addressLine1 || address.line1;
  const city = address.city;
  const postalCode = address.postalCode || address.postal_code;
  const country = address.country;
  if (!line1 || !city || !postalCode || !country) return null;

  const composedName = [address.firstName, address.lastName].filter(Boolean).join(" ").trim();
  const name = composedName || address.name || "Customer";

  return {
    name,
    line1,
    line2: address.addressLine2 || address.line2 || null,
    city,
    state: address.stateProvince || address.state || null,
    postalCode,
    country,
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout session" }, { status: 400 });
  }

  const { data: session, error: sessionError } = await supabase
    .from("payment_sessions")
    .select("id, status, currency, amount_cents, shipping_address, payment_provider, provider_payment_id")
    .eq("id", parsed.data.checkoutSessionId)
    .maybeSingle();

  if (sessionError) {
    console.error("Unable to load checkout session for payment", sessionError);
    return NextResponse.json({ error: "Unable to load checkout session" }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: "Checkout session not found" }, { status: 404 });
  }
  if (!['pending', 'requires_payment'].includes(session.status)) {
    return NextResponse.json({ error: "Checkout session is not payable" }, { status: 409 });
  }
  if (session.payment_provider || session.provider_payment_id) {
    return NextResponse.json(
      { error: "Payment is already initialized for this checkout", code: "PAYMENT_ALREADY_INITIALIZED" },
      { status: 409 },
    );
  }

  let provider;
  try {
    provider = getPaymentProvider();
  } catch (error) {
    if (error instanceof PaymentProviderUnavailableError) {
      return NextResponse.json(
        { error: error.message, code: "PAYMENT_PROVIDER_UNAVAILABLE" },
        { status: 503 },
      );
    }
    throw error;
  }

  if (!provider.configured) {
    return NextResponse.json(
      {
        error: "Payment processing is pending processor onboarding",
        code: "PAYMENT_PROVIDER_UNAVAILABLE",
      },
      { status: 503 },
    );
  }

  try {
    const initialized = await provider.initializePayment({
      checkoutSessionId: session.id,
      amountCents: Number(session.amount_cents),
      currency: "usd",
      buyerId: user.id,
      buyerEmail: user.email,
      shippingAddress: toProviderAddress(session.shipping_address),
    });

    const { error: attachError } = await supabase.rpc(
      "attach_checkout_payment_reference",
      {
        p_session_id: session.id,
        p_provider: initialized.provider,
        p_provider_payment_id: initialized.providerPaymentId,
      },
    );

    if (attachError) throw attachError;

    return NextResponse.json({
      checkoutSessionId: session.id,
      amountCents: Number(session.amount_cents),
      currency: "usd",
      provider: initialized.provider,
      providerPaymentId: initialized.providerPaymentId,
      nextAction: initialized.nextAction,
    });
  } catch (error) {
    // Once provider initialization is attempted, an ambiguous failure must not
    // leave a locally payable session that can be initialized a second time.
    // Existing terminal-state handling rejects any later provider success as a
    // reconciliation incident instead of risking duplicate money movement.
    await supabase.rpc("cancel_checkout_session", {
      p_session_id: session.id,
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
