import { NextRequest, NextResponse } from "next/server";
import { logOperationalError } from "@/lib/observability/operationalEvent";
import { reportOperationalError } from "@/lib/observability/operationalEventSink";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getPaymentProvider,
  PaymentProviderUnavailableError,
} from "@/lib/payments/provider";

export async function POST(request: NextRequest) {
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

    await reportOperationalError("payments.webhook_provider_resolution_failed", error, {
      component: "payments",
      operation: "resolve-webhook-provider",
      route: "/api/payments/webhook",
    });
    return NextResponse.json({ error: "Payment webhook unavailable" }, { status: 503 });
  }

  if (!provider.configured) {
    return NextResponse.json(
      {
        error: "Payment webhook is pending processor onboarding",
        code: "PAYMENT_PROVIDER_UNAVAILABLE",
      },
      { status: 503 },
    );
  }

  try {
    const event = await provider.verifyWebhook(request);

    const { data, error } = await getSupabaseAdmin().rpc(
      "finalize_checkout_payment_v2",
      {
        p_event_id: event.eventId,
        p_event_type: event.eventType,
        p_session_id: event.checkoutSessionId,
        p_provider: event.provider,
        p_provider_payment_id: event.providerPaymentId,
        p_outcome: event.outcome,
      },
    );

    if (error) {
      // Signature verification already succeeded, so failure to durably apply a
      // provider event can leave external money state ahead of local state.
      await reportOperationalError("payments.webhook_finalization_failed", error, {
        component: "payments",
        operation: "finalize-verified-payment-webhook",
        severity: "critical",
        route: "/api/payments/webhook",
        recordId: event.checkoutSessionId,
      });
      return NextResponse.json(
        { error: "Webhook processing failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ received: true, processed: data });
  } catch (error) {
    if (error instanceof PaymentProviderUnavailableError) {
      await reportOperationalError("payments.webhook_provider_unavailable", error, {
        component: "payments",
        operation: "verify-payment-webhook",
        route: "/api/payments/webhook",
      });
      return NextResponse.json(
        { error: error.message, code: "PAYMENT_PROVIDER_UNAVAILABLE" },
        { status: 503 },
      );
    }

    // Invalid signatures/payloads are attacker/client-controlled input, not a
    // production availability incident. Emit only a constant sanitized runtime
    // diagnostic; never persist the verifier exception or request material.
    logOperationalError(
      "payments.webhook_verification_rejected",
      "payment webhook rejected by provider verifier",
      {
        component: "payments",
        operation: "verify-payment-webhook",
        severity: "warning",
        route: "/api/payments/webhook",
      },
    );
    return NextResponse.json({ error: "Invalid payment webhook" }, { status: 400 });
  }
}
