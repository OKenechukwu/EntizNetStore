import { NextRequest, NextResponse } from "next/server";
import { logOperationalError } from "@/lib/observability/operationalEvent";
import { reportOperationalError } from "@/lib/observability/operationalEventSink";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getPayoutProvider,
  PayoutProviderUnavailableError,
} from "@/lib/payouts/provider";

export async function POST(request: NextRequest) {
  let provider;
  try {
    provider = getPayoutProvider();
  } catch (error) {
    if (error instanceof PayoutProviderUnavailableError) {
      return NextResponse.json(
        { error: error.message, code: "PAYOUT_PROVIDER_UNAVAILABLE" },
        { status: 503 },
      );
    }

    await reportOperationalError("payouts.webhook_provider_resolution_failed", error, {
      component: "payouts",
      operation: "resolve-webhook-provider",
      route: "/api/payments/payout-webhook",
    });
    return NextResponse.json({ error: "Payout webhook unavailable" }, { status: 503 });
  }

  if (!provider.configured) {
    return NextResponse.json(
      {
        error: "Payout webhook is pending processor onboarding",
        code: "PAYOUT_PROVIDER_UNAVAILABLE",
      },
      { status: 503 },
    );
  }

  try {
    // The adapter authenticates/verifies the provider signature before returning
    // this normalized event.
    const event = await provider.verifyWebhook(request);

    const { data, error } = await getSupabaseAdmin().rpc(
      "finalize_seller_payout_v1",
      {
        p_provider: event.provider,
        p_event_id: event.eventId,
        p_event_type: event.eventType,
        p_payout_request_id: event.payoutRequestId,
        p_provider_payout_id: event.providerPayoutId,
        p_outcome: event.outcome,
      },
    );

    if (error) {
      // A verified payout event that cannot be durably finalized can leave the
      // provider and escrow ledgers inconsistent. Page immediately without
      // serializing provider identifiers or the raw event.
      await reportOperationalError("payouts.webhook_finalization_failed", error, {
        component: "payouts",
        operation: "finalize-verified-payout-webhook",
        severity: "critical",
        route: "/api/payments/payout-webhook",
        recordId: event.payoutRequestId,
      });
      return NextResponse.json(
        { error: "Payout webhook processing failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ received: true, processed: data });
  } catch (error) {
    if (error instanceof PayoutProviderUnavailableError) {
      await reportOperationalError("payouts.webhook_provider_unavailable", error, {
        component: "payouts",
        operation: "verify-payout-webhook",
        route: "/api/payments/payout-webhook",
      });
      return NextResponse.json(
        { error: error.message, code: "PAYOUT_PROVIDER_UNAVAILABLE" },
        { status: 503 },
      );
    }

    // Forged/invalid callback traffic must not be able to manufacture an
    // operational incident. Keep only a constant, sanitized runtime warning.
    logOperationalError(
      "payouts.webhook_verification_rejected",
      "payout webhook rejected by provider verifier",
      {
        component: "payouts",
        operation: "verify-payout-webhook",
        severity: "warning",
        route: "/api/payments/payout-webhook",
      },
    );
    return NextResponse.json({ error: "Invalid payout webhook" }, { status: 400 });
  }
}
