"use client";

import { useState } from "react";
import type { CartItem } from "@/lib/cart";

const publicProvider = (
  process.env.NEXT_PUBLIC_PAYMENT_PROVIDER || "unconfigured"
).trim().toLowerCase();

function ProviderPending() {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-semibold">Secure payment activation is pending.</p>
      <p className="mt-1">
        EntizNetStore checkout, inventory reservation, order splitting and escrow
        are built and tested. Card/payment processing will open after the final
        marketplace payment provider is approved and connected before launch.
      </p>
    </div>
  );
}

export default function CartPayment({
  cart,
  onSuccess,
}: {
  cart: CartItem[];
  onSuccess: () => void;
}) {
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [address, setAddress] = useState({
    name: "",
    line1: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
  });

  if (publicProvider === "unconfigured") {
    return <ProviderPending />;
  }

  async function beginPayment(event: React.FormEvent) {
    event.preventDefault();
    setProcessing(true);
    setError("");

    try {
      const response = await fetch("/api/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          items: cart.map((item) => ({
            productId: item.id,
            variantId: item.variantId,
            quantity: item.qty,
          })),
          shippingAddress: address,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Unable to initialize payment");
      }

      if (result.nextAction?.type === "redirect" && result.nextAction.url) {
        window.location.assign(result.nextAction.url);
        return;
      }

      if (result.nextAction?.type === "none") {
        onSuccess();
        return;
      }

      throw new Error(
        "This payment provider requires a checkout UI adapter that has not been enabled yet.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment failed");
      setIdempotencyKey(crypto.randomUUID());
    } finally {
      setProcessing(false);
    }
  }

  const field = "w-full rounded-lg border px-3 py-2";

  return (
    <form onSubmit={beginPayment} className="space-y-4">
      <h2 className="text-lg font-semibold">Shipping and payment</h2>
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          required
          placeholder="Full name"
          value={address.name}
          onChange={(event) => setAddress({ ...address, name: event.target.value })}
          className={field}
        />
        <input
          required
          placeholder="Address"
          value={address.line1}
          onChange={(event) => setAddress({ ...address, line1: event.target.value })}
          className={field}
        />
        <input
          required
          placeholder="City"
          value={address.city}
          onChange={(event) => setAddress({ ...address, city: event.target.value })}
          className={field}
        />
        <input
          placeholder="State / province"
          value={address.state}
          onChange={(event) => setAddress({ ...address, state: event.target.value })}
          className={field}
        />
        <input
          required
          placeholder="Postal code"
          value={address.postalCode}
          onChange={(event) => setAddress({ ...address, postalCode: event.target.value })}
          className={field}
        />
        <input
          required
          minLength={2}
          maxLength={2}
          placeholder="Country code"
          value={address.country}
          onChange={(event) => setAddress({ ...address, country: event.target.value.toUpperCase() })}
          className={field}
        />
      </div>
      <button
        type="submit"
        disabled={processing || cart.length === 0}
        className="w-full rounded-lg bg-black py-3 font-medium text-white disabled:opacity-50"
      >
        {processing ? "Opening secure payment…" : "Continue to secure payment"}
      </button>
      <p className="text-center text-xs text-gray-500">
        The final USD amount is recalculated securely from the live catalog before any provider is asked to collect payment.
      </p>
    </form>
  );
}
