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
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/seller/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: next,
          shippingCarrier: carrier || undefined,
          trackingNumber: tracking || undefined,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to update order");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update order");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t pt-4">
      {next === "shipped" && (
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <input
            value={carrier}
            onChange={(event) => setCarrier(event.target.value)}
            placeholder="Shipping carrier"
            maxLength={100}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            value={tracking}
            onChange={(event) => setTracking(event.target.value)}
            placeholder="Tracking number"
            maxLength={200}
            className="rounded-lg border px-3 py-2 text-sm"
          />
        </div>
      )}
      {error && <p className="mb-2 text-sm text-red-700">{error}</p>}
      <button
        type="button"
        onClick={transition}
        disabled={busy || (next === "shipped" && (!carrier.trim() || !tracking.trim()))}
        className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
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
