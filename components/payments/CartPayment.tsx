"use client";

import { useEffect, useState } from "react";

const publicProvider = (
  process.env.NEXT_PUBLIC_PAYMENT_PROVIDER || "unconfigured"
).trim().toLowerCase();

function ProviderPending() {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-semibold">Secure payment activation is pending.</p>
      <p className="mt-1">
        EntizNetStore&apos;s canonical cart, quote, order, inventory reservation and escrow
        flow is built and tested. Payment collection will open only after the final
        marketplace processor is approved and connected before launch.
      </p>
    </div>
  );
}

type PaymentResult = {
  error?: string;
  code?: string;
  checkoutSessionId?: string;
  nextAction?: { type?: string; url?: string | null };
};

export default function CartPayment({
  cartId,
  quoteId,
  onNeedsRequote,
}: {
  cartId: string;
  quoteId: string;
  onNeedsRequote: () => void;
}) {
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
    setCheckoutSessionId(null);
    setError("");
    setStatus("");
  }, [cartId, quoteId]);

  if (publicProvider === "unconfigured") {
    return <ProviderPending />;
  }

  async function beginPayment() {
    setProcessing(true);
    setError("");
    setStatus("");

    try {
      let sessionId = checkoutSessionId;
      if (!sessionId) {
        const sessionResponse = await fetch("/api/checkout/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartId, quoteId, idempotencyKey }),
        });
        const session = (await sessionResponse.json().catch(() => ({}))) as PaymentResult;
        if (!sessionResponse.ok || !session.checkoutSessionId) {
          if ([400, 403, 404, 409].includes(sessionResponse.status)) onNeedsRequote();
          throw new Error(session.error || "Unable to create secure checkout session");
        }
        sessionId = session.checkoutSessionId;
        setCheckoutSessionId(sessionId);
      }

      const response = await fetch("/api/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutSessionId: sessionId }),
      });
      const result = (await response.json().catch(() => ({}))) as PaymentResult;

      if (!response.ok) {
        if (result.code === "PAYMENT_ALREADY_INITIALIZED") {
          throw new Error(
            "Payment was already initialized for this checkout. EntizNetStore will not create a duplicate payment. If you did not reach the processor, refresh the checkout status or contact support.",
          );
        }
        if (response.status === 409) onNeedsRequote();
        throw new Error(result.error || "Unable to initialize payment");
      }

      if (result.nextAction?.type === "redirect" && result.nextAction.url) {
        window.location.assign(result.nextAction.url);
        return;
      }

      if (result.nextAction?.type === "none") {
        setStatus(
          "Payment initialization was accepted. The order remains pending until the payment provider confirms the transaction.",
        );
        return;
      }

      throw new Error(
        "This payment provider requires a checkout UI adapter that has not been enabled yet.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment failed");
      // Never rotate the idempotency key or silently create a second session on
      // retry. Replays remain bound to this cart/quote until the parent explicitly
      // requires a fresh trusted quote.
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {status && (
        <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          {status}
        </div>
      )}
      <button
        type="button"
        onClick={() => void beginPayment()}
        disabled={processing}
        className="min-h-11 w-full rounded-lg bg-black px-4 py-3 font-medium text-white disabled:opacity-50"
      >
        {processing ? "Opening secure payment…" : checkoutSessionId ? "Retry secure payment" : "Continue to secure payment"}
      </button>
      <p className="text-center text-xs text-gray-500">
        The amount, Seller split, shipping address and inventory reservation come only from the consumed server quote. Browser-supplied item prices are never accepted here.
      </p>
    </div>
  );
}
