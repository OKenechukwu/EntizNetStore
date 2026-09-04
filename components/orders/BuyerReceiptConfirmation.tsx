"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function BuyerReceiptConfirmation({ orderId }: { orderId: string }) {
  const router = useRouter();
  const idempotencyKey = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function confirmReceipt() {
    if (busy || confirmed) return;
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/buyer/orders/${orderId}/confirm-receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: idempotencyKey.current }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Unable to confirm receipt. Refresh and try again.");
      }

      // The authority call has succeeded, so make this client action terminal
      // immediately. router.refresh() reconciles the page with the durable
      // settlement evidence, but UI correctness must not depend on refresh timing.
      setConfirmed(true);
      setNotice("Receipt confirmed. The seller payout hold period now follows the platform settlement policy.");
      idempotencyKey.current = null;
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to confirm receipt. Refresh and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      {!confirmed && (
        <p className="mb-3 text-sm text-foreground/75">
          Confirm only after you have received and accepted this order. Confirmation starts the seller payout hold period; disputes and refunds still block payout when applicable.
        </p>
      )}
      {error && (
        <p className="mb-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-2 text-sm text-foreground/80" role="status">
          {notice}
        </p>
      )}
      {!confirmed && (
        <button
          type="button"
          onClick={confirmReceipt}
          disabled={busy}
          className="min-h-11 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Confirming…" : "Confirm receipt"}
        </button>
      )}
    </div>
  );
}
