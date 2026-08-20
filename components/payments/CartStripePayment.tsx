"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import type { CartItem } from "@/lib/cart";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function PaymentForm({ cart, onSuccess }: { cart: CartItem[]; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [address, setAddress] = useState({ name: "", line1: "", city: "", state: "", postalCode: "", country: "US" });

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
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
      if (!response.ok || !result.clientSecret) throw new Error(result.error || "Unable to initialize payment");

      const card = elements.getElement(CardElement);
      if (!card) throw new Error("Payment form is unavailable");
      const confirmation = await stripe.confirmCardPayment(result.clientSecret, {
        payment_method: {
          card,
          billing_details: {
            name: address.name,
            address: {
              line1: address.line1,
              city: address.city,
              state: address.state || undefined,
              postal_code: address.postalCode,
              country: address.country,
            },
          },
        },
      });
      if (confirmation.error) throw new Error(confirmation.error.message || "Payment failed");
      if (confirmation.paymentIntent?.status !== "succeeded") throw new Error("Payment is still pending");

      onSuccess();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment failed");
      setIdempotencyKey(crypto.randomUUID());
    } finally {
      setProcessing(false);
    }
  }

  const field = "w-full rounded-lg border px-3 py-2";
  return (
    <form onSubmit={pay} className="space-y-4">
      <h2 className="text-lg font-semibold">Shipping and payment</h2>
      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <input required placeholder="Full name" value={address.name} onChange={(e) => setAddress({ ...address, name: e.target.value })} className={field} />
        <input required placeholder="Address" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} className={field} />
        <input required placeholder="City" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} className={field} />
        <input placeholder="State / province" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} className={field} />
        <input required placeholder="Postal code" value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} className={field} />
        <input required minLength={2} maxLength={2} placeholder="Country code" value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value.toUpperCase() })} className={field} />
      </div>
      <div className="rounded-lg border bg-white p-4"><CardElement /></div>
      <button type="submit" disabled={!stripe || processing || cart.length === 0} className="w-full rounded-lg bg-black py-3 font-medium text-white disabled:opacity-50">
        {processing ? "Processing secure payment…" : "Pay securely with Stripe"}
      </button>
      <p className="text-center text-xs text-gray-500">The final USD amount is recalculated securely from the live catalog before payment.</p>
    </form>
  );
}

export default function CartStripePayment(props: { cart: CartItem[]; onSuccess: () => void }) {
  if (!stripePromise) {
    return <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Secure payment is not yet configured. Checkout will open after the Stripe account is connected.</div>;
  }
  return <Elements stripe={stripePromise}><PaymentForm {...props} /></Elements>;
}
