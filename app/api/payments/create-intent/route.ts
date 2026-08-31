import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reportOperationalError } from "@/lib/observability/operationalEventSink";
import {
  getPaymentProvider,
  PaymentProviderUnavailableError,
} from "@/lib/payments/provider";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

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

type RpcError = {
  code?: string | null;
  message?: string | null;
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

function isInitializationConflict(error: RpcError | null) {
  return error?.code === "55P03" || error?.code === "22023" || error?.code === "42501";
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout session" }, { status: 400 });
  }

  // Buyer identity/RLS determines which checkout is visible. Privileged payment
  // mutation later uses the server-only service client with an explicit Buyer ID.
  const { data: session, error: sessionError } = await supabase
    .from("payment_sessions")
    .select("id, status, currency, amount_cents, shipping_address, payment_provider, provider_payment_id")
    .eq("id", parsed.data.checkoutSessionId)
    .maybeSingle();

  if (sessionError) {
    await reportOperationalError("payments.checkout_session_load_failed", sessionError, {
      component: "payments",
      operation: "load-checkout-session",
      route: "/api/payments/create-intent",
      actorId: user.id,
      recordId: parsed.data.checkoutSessionId,
    });
    return NextResponse.json({ error: "Unable to load checkout session" }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: "Checkout session not found" }, { status: 404 });
  }
  if (!["pending", "requires_payment"].includes(session.status)) {
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
    await reportOperationalError("payments.provider_resolution_failed", error, {
      component: "payments",
      operation: "resolve-payment-provider",
      route: "/api/payments/create-intent",
      actorId: user.id,
      recordId: session.id,
    });
    return NextResponse.json({ error: "Unable to initialize payment" }, { status: 503 });
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

  const admin = getSupabaseAdmin();
  const initializationAttemptId = randomUUID();

  // Claim before any external processor call. The database row lock + durable
  // attempt ID guarantee that concurrent HTTP requests cannot both initialize a
  // processor payment for the same checkout.
  const { error: claimError } = await admin.rpc(
    "service_claim_checkout_payment_initialization",
    {
      p_session_id: session.id,
      p_buyer_id: user.id,
      p_attempt_id: initializationAttemptId,
    },
  );

  if (claimError) {
    if (!isInitializationConflict(claimError)) {
      await reportOperationalError("payments.initialization_claim_failed", claimError, {
        component: "payments",
        operation: "claim-payment-initialization",
        severity: "error",
        route: "/api/payments/create-intent",
        actorId: user.id,
        recordId: session.id,
      });
      return NextResponse.json({ error: "Unable to initialize payment" }, { status: 503 });
    }

    return NextResponse.json(
      {
        error: "Payment initialization is already in progress or this checkout is no longer payable",
        code: "PAYMENT_INITIALIZATION_CONFLICT",
      },
      { status: 409 },
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

    const { error: attachError } = await admin.rpc(
      "service_attach_checkout_payment_reference",
      {
        p_session_id: session.id,
        p_buyer_id: user.id,
        p_attempt_id: initializationAttemptId,
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
    // Once the processor call has been attempted, failure is potentially
    // ambiguous. Only the trusted service path may cancel, and it refuses to do
    // so if a provider reference actually reached the database. That case is
    // deliberately left for reconciliation rather than risking lost money.
    const { error: cancelError } = await admin.rpc(
      "service_cancel_checkout_after_payment_initialization_failure",
      {
        p_session_id: session.id,
        p_buyer_id: user.id,
        p_attempt_id: initializationAttemptId,
      },
    );

    if (cancelError) {
      await reportOperationalError(
        "payments.checkout_cancel_failed_after_initialization_error",
        cancelError,
        {
          component: "payments",
          operation: "cancel-checkout-after-payment-failure",
          severity: "critical",
          route: "/api/payments/create-intent",
          actorId: user.id,
          recordId: session.id,
        },
      );
    }

    if (error instanceof PaymentProviderUnavailableError) {
      await reportOperationalError("payments.provider_unavailable", error, {
        component: "payments",
        operation: "initialize-payment",
        route: "/api/payments/create-intent",
        actorId: user.id,
        recordId: session.id,
      });
      return NextResponse.json(
        { error: error.message, code: "PAYMENT_PROVIDER_UNAVAILABLE" },
        { status: 503 },
      );
    }

    await reportOperationalError("payments.initialization_uncertain", error, {
      component: "payments",
      operation: "initialize-or-attach-payment",
      severity: "critical",
      route: "/api/payments/create-intent",
      actorId: user.id,
      recordId: session.id,
    });

    return NextResponse.json(
      { error: "Unable to initialize payment" },
      { status: 503 },
    );
  }
}
