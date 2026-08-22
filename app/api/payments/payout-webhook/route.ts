import { NextRequest, NextResponse } from "next/server";
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
    throw error;
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
    // The adapter is responsible for authenticating/verifying the provider
    // signature before it can return this normalized event.
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
      console.error("Payout webhook database finalization failed", {
        payoutRequestId: event.payoutRequestId,
        provider: event.provider,
        databaseCode: error.code,
      });
      return NextResponse.json(
        { error: "Payout webhook processing failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ received: true, processed: data });
  } catch (error) {
    if (error instanceof PayoutProviderUnavailableError) {
      return NextResponse.json(
        { error: error.message, code: "PAYOUT_PROVIDER_UNAVAILABLE" },
        { status: 503 },
      );
    }

    console.error("Payout webhook verification failed", {
      provider: provider.name,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ error: "Invalid payout webhook" }, { status: 400 });
  }
}
