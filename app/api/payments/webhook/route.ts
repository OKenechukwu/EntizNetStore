import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getPaymentProvider,
  PaymentProviderUnavailableError,
} from "@/lib/payments/provider";

export async function POST(request: NextRequest) {
  const provider = getPaymentProvider();
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
      console.error("Payment webhook database finalization failed:", error);
      return NextResponse.json(
        { error: "Webhook processing failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ received: true, processed: data });
  } catch (error) {
    if (error instanceof PaymentProviderUnavailableError) {
      return NextResponse.json(
        { error: error.message, code: "PAYMENT_PROVIDER_UNAVAILABLE" },
        { status: 503 },
      );
    }

    console.error("Payment webhook verification failed:", error);
    return NextResponse.json({ error: "Invalid payment webhook" }, { status: 400 });
  }
}
