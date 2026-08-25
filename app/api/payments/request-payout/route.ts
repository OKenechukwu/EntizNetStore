import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reportOperationalError } from "@/lib/observability/operationalEventSink";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getPayoutProvider,
  PayoutProviderUnavailableError,
} from "@/lib/payouts/provider";

const requestSchema = z.object({
  idempotencyKey: z.string().uuid(),
});

function getPayoutHoldDays(): number | null {
  const raw = process.env.PAYOUT_HOLD_DAYS?.trim();
  if (!raw || !/^\d{1,3}$/.test(raw)) return null;

  const days = Number(raw);
  if (!Number.isSafeInteger(days) || days < 0 || days > 365) return null;
  return days;
}

function isConfiguredPayoutMethod(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value
      && typeof value === "object"
      && !Array.isArray(value)
      && Object.keys(value as Record<string, unknown>).length > 0,
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    await reportOperationalError("payouts.provider_resolution_failed", error, {
      component: "payouts",
      operation: "resolve-payout-provider",
      route: "/api/payments/request-payout",
      actorId: user.id,
    });
    return NextResponse.json({ error: "Seller payouts are temporarily unavailable" }, { status: 503 });
  }

  if (!provider.configured) {
    return NextResponse.json(
      {
        error: "Seller payouts are pending processor onboarding",
        code: "PAYOUT_PROVIDER_UNAVAILABLE",
      },
      { status: 503 },
    );
  }

  const holdDays = getPayoutHoldDays();
  if (holdDays === null) {
    return NextResponse.json(
      {
        error: "Seller payout release policy is not configured",
        code: "PAYOUT_POLICY_UNAVAILABLE",
      },
      { status: 503 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid payout request" },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();

  const [{ data: seller, error: sellerError }, { data: privateProfile, error: privateError }] = await Promise.all([
    admin
      .from("profiles_seller")
      .select("id, verification_status")
      .eq("id", user.id)
      .maybeSingle(),
    admin
      .from("profiles_seller_private")
      .select("payout_method")
      .eq("seller_id", user.id)
      .maybeSingle(),
  ]);

  if (sellerError || privateError) {
    await reportOperationalError(
      "payouts.seller_account_lookup_failed",
      sellerError ?? privateError ?? "seller payout account lookup failed",
      {
        component: "payouts",
        operation: "load-seller-payout-account",
        route: "/api/payments/request-payout",
        actorId: user.id,
      },
    );
    return NextResponse.json({ error: "Unable to verify payout account" }, { status: 503 });
  }

  if (!seller || seller.verification_status !== "verified") {
    return NextResponse.json(
      { error: "Verified seller account required", code: "SELLER_NOT_VERIFIED" },
      { status: 403 },
    );
  }

  const payoutMethod = privateProfile?.payout_method;
  if (!isConfiguredPayoutMethod(payoutMethod)) {
    return NextResponse.json(
      { error: "Configure a payout method before requesting funds", code: "PAYOUT_METHOD_REQUIRED" },
      { status: 409 },
    );
  }

  const eligibleBefore = new Date(Date.now() - holdDays * 24 * 60 * 60 * 1000).toISOString();
  const { data: payoutRows, error: payoutError } = await admin.rpc(
    "request_seller_payout",
    {
      p_seller_id: user.id,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_eligible_before: eligibleBefore,
    },
  );

  const payout = payoutRows?.[0];
  if (payoutError || !payout) {
    const noBalance = payoutError?.code === "P0001";

    if (!noBalance) {
      await reportOperationalError(
        "payouts.request_creation_failed",
        payoutError ?? "payout request RPC returned no row",
        {
          component: "payouts",
          operation: "reserve-eligible-escrow",
          route: "/api/payments/request-payout",
          actorId: user.id,
        },
      );
    }

    return NextResponse.json(
      {
        error: noBalance
          ? "No eligible escrow balance is available for payout"
          : "Unable to create payout request",
        code: noBalance ? "NO_ELIGIBLE_PAYOUT_BALANCE" : "PAYOUT_REQUEST_FAILED",
      },
      { status: noBalance ? 409 : 503 },
    );
  }

  const payoutRequestId = String(payout.payout_request_id);
  const amountCents = Number(payout.amount_cents);
  const payoutStatus = String(payout.payout_status);

  // Exact retries after a durable provider attachment or completed payout do not
  // initialize another external transfer.
  if (payoutStatus === "processing" || payoutStatus === "succeeded") {
    return NextResponse.json({
      payoutRequestId,
      amountCents,
      currency: "usd",
      status: payoutStatus,
    });
  }

  if (payoutStatus === "failed" || payoutStatus === "cancelled") {
    return NextResponse.json(
      {
        error: "This payout request is terminal; create a new request after reconciliation",
        code: "PAYOUT_REQUEST_TERMINAL",
      },
      { status: 409 },
    );
  }

  try {
    // A real provider adapter MUST use payoutRequestId as its own idempotency
    // reference. If this network call is ambiguous, escrow stays reserved and an
    // exact retry can safely reconcile instead of risking a duplicate transfer.
    const initialized = await provider.initializePayout({
      payoutRequestId,
      sellerId: user.id,
      amountCents,
      currency: "usd",
      payoutMethod,
    });

    const { error: attachError } = await admin.rpc(
      "attach_seller_payout_provider_reference",
      {
        p_payout_request_id: payoutRequestId,
        p_provider: initialized.provider,
        p_provider_payout_id: initialized.providerPayoutId,
      },
    );

    if (attachError) {
      // Do NOT release the escrow reservation here. The external processor may
      // already have accepted money even though local persistence failed.
      await reportOperationalError("payouts.provider_reference_reconciliation_required", attachError, {
        component: "payouts",
        operation: "attach-provider-reference",
        severity: "critical",
        route: "/api/payments/request-payout",
        actorId: user.id,
        recordId: payoutRequestId,
      });
      return NextResponse.json(
        {
          error: "Payout requires reconciliation before it can be retried",
          code: "PAYOUT_RECONCILIATION_REQUIRED",
          payoutRequestId,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      payoutRequestId,
      amountCents,
      currency: "usd",
      status: "processing",
      provider: initialized.provider,
    });
  } catch (error) {
    // Network/provider initialization failures are intentionally fail-closed.
    // A timeout is ambiguous: the provider may already have accepted the
    // transfer. Escrow therefore remains reserved for reconciliation and the
    // incident pages immediately without logging payout/provider identifiers.
    await reportOperationalError("payouts.initialization_uncertain", error, {
      component: "payouts",
      operation: "initialize-payout",
      severity: "critical",
      route: "/api/payments/request-payout",
      actorId: user.id,
      recordId: payoutRequestId,
    });

    return NextResponse.json(
      {
        error: "Payout initialization is pending reconciliation",
        code: "PAYOUT_INITIALIZATION_UNCERTAIN",
        payoutRequestId,
      },
      { status: 503 },
    );
  }
}
