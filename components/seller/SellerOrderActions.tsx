"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SellerOrderActions({
  orderId,
  status,
  paymentStatus,
}: {
  orderId: string;
  status: string;
  paymentStatus: string;
}) {
  const router = useRouter();
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (paymentStatus !== "paid" || status === "delivered") return null;

  const next =
    status === "confirmed"
      ? "processing"
      : status === "processing"
        ? "shipped"
        : status === "shipped"
          ? "delivered"
          : null;
  if (!next) return null;

  async function transition() {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/seller/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: next,
          shippingCarrier: carrier.trim() || undefined,
          trackingNumber: tracking.trim() || undefined,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Unable to update order. Refresh and try again.");
      }
      setNotice(
        result.order?.idempotent
          ? "This fulfillment update was already recorded."
          : next === "processing"
            ? "Order moved to processing."
            : next === "shipped"
              ? "Shipment and tracking were recorded."
              : "Delivery was recorded. Payout release follows the separate payout eligibility process.",
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update order. Refresh and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      {next === "shipped" && (
        <fieldset className="mb-3 grid gap-3 sm:grid-cols-2" disabled={busy}>
          <legend className="sr-only">Shipment tracking details</legend>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Shipping carrier</span>
            <input
              value={carrier}
              onChange={(event) => setCarrier(event.target.value)}
              autoComplete="off"
              maxLength={100}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Tracking number</span>
            <input
              value={tracking}
              onChange={(event) => setTracking(event.target.value)}
              autoComplete="off"
              maxLength={200}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
        </fieldset>
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
      <button
        type="button"
        onClick={transition}
        disabled={busy || (next === "shipped" && (!carrier.trim() || !tracking.trim()))}
        className="min-h-11 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy
          ? "Updating…"
          : next === "processing"
            ? "Start processing"
            : next === "shipped"
              ? "Mark shipped"
              : "Mark delivered"}
      </button>
    </div>
  );
}
