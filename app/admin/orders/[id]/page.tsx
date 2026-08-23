import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type OrderDetail = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  shippingAddress: Record<string, unknown> | null;
  billingAddress: Record<string, unknown> | null;
  shippingMethod: string | null;
  trackingNumber: string | null;
  shippingCarrier: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  buyer: { id: string; email: string | null; displayName: string | null; firstName: string | null; lastName: string | null; capabilityActive: boolean };
  seller: { id: string; email: string | null; storefrontName: string | null; storeSlug: string | null; verificationStatus: string | null; capabilityActive: boolean };
  items: Array<{ id: string; productId: string | null; variantId: string | null; productTitle: string; variantTitle: string | null; sku: string | null; quantity: number; priceCents: number; totalCents: number; requiresShipping: boolean; isDigital: boolean; fulfillmentStatus: string; createdAt: string }>;
  paymentSession: null | { id: string; status: string; currency: string; amountCents: number; paymentProvider: string | null; providerPaymentId: string | null; idempotencyKey: string; createdAt: string; updatedAt: string };
  escrow: Array<{ id: string; sellerId: string; amountCents: number; status: string; releasedAt: string | null; releaseReason: string | null; disputeId: string | null; createdAt: string; updatedAt: string }>;
  payouts: Array<{ id: string; sellerId: string; status: string; currency: string; amountCents: number; provider: string | null; providerPayoutId: string | null; failureCode: string | null; failureMessage: string | null; createdAt: string; updatedAt: string; completedAt: string | null }>;
  recentAudit: Array<{ id: string; adminId: string; action: string; targetType: string; targetId: string; metadata: Record<string, unknown> | null; timestamp: string }>;
};

function money(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide opacity-55">{label}</dt><dd className="mt-1 break-words text-sm">{children ?? "—"}</dd></div>;
}

function State({ value }: { value: string }) {
  const positive = ["paid", "confirmed", "delivered", "fulfilled", "released", "succeeded"].includes(value);
  const negative = ["failed", "cancelled", "refunded"].includes(value);
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${positive ? "bg-emerald-100 text-emerald-800" : negative ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{value.replaceAll("_", " ")}</span>;
}

function Address({ value }: { value: Record<string, unknown> | null }) {
  if (!value) return <span className="opacity-60">Not required / unavailable</span>;
  return <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify(value, null, 2)}</pre>;
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/auth/sign-in");
  if (user.app_metadata?.role !== "admin") redirect("/store");

  const { id } = await params;
  const admin = getSupabaseAdmin();
  const { data, error: detailError } = await admin.rpc("admin_get_marketplace_order", {
    p_admin_id: user.id,
    p_order_id: id,
  });
  if (detailError || !data) notFound();
  const order = data as OrderDetail;
  const currency = order.paymentSession?.currency || "usd";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/admin/orders" className="text-sm text-sky-700 hover:underline">← Orders & payment operations</Link>
      <div className="mt-3 mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-bold">{order.orderNumber}</h1><p className="mt-1 font-mono text-xs opacity-55">{order.id}</p></div>
        <div className="flex flex-wrap gap-2"><State value={order.status} /><State value={order.paymentStatus} /><State value={order.fulfillmentStatus} /></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border p-5 lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">Order summary</h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Subtotal">{money(order.subtotalCents, currency)}</Field>
            <Field label="Tax">{money(order.taxCents, currency)}</Field>
            <Field label="Shipping">{money(order.shippingCents, currency)}</Field>
            <Field label="Discount">{money(order.discountCents, currency)}</Field>
            <Field label="Total"><span className="font-semibold">{money(order.totalCents, currency)}</span></Field>
            <Field label="Created">{new Date(order.createdAt).toLocaleString()}</Field>
          </dl>
        </section>
        <section className="rounded-xl border p-5">
          <h2 className="mb-4 text-lg font-semibold">Operational state</h2>
          <div className="space-y-3 text-sm">
            <div><span className="opacity-60">Order</span><div className="mt-1"><State value={order.status} /></div></div>
            <div><span className="opacity-60">Payment</span><div className="mt-1"><State value={order.paymentStatus} /></div></div>
            <div><span className="opacity-60">Fulfillment</span><div className="mt-1"><State value={order.fulfillmentStatus} /></div></div>
            <p className="pt-2 text-xs opacity-60">Mutations are intentionally not exposed as free-form status edits. Refund/dispute/fulfillment actions use dedicated trusted workflows.</p>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border p-5"><h2 className="mb-4 text-lg font-semibold">Buyer</h2><dl className="grid gap-4 sm:grid-cols-2"><Field label="Account"><Link href={`/admin/accounts/${order.buyer.id}`} className="text-sky-700 hover:underline">{order.buyer.email || order.buyer.id}</Link></Field><Field label="Display name">{order.buyer.displayName || [order.buyer.firstName, order.buyer.lastName].filter(Boolean).join(" ") || "—"}</Field><Field label="Capability">{order.buyer.capabilityActive ? "Active" : "Suspended"}</Field></dl></section>
        <section className="rounded-xl border p-5"><h2 className="mb-4 text-lg font-semibold">Seller</h2><dl className="grid gap-4 sm:grid-cols-2"><Field label="Account"><Link href={`/admin/accounts/${order.seller.id}`} className="text-sky-700 hover:underline">{order.seller.storefrontName || order.seller.email || order.seller.id}</Link></Field><Field label="Verification">{order.seller.verificationStatus}</Field><Field label="Capability">{order.seller.capabilityActive ? "Active" : "Suspended"}</Field><Field label="Store slug">{order.seller.storeSlug}</Field></dl></section>
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border">
        <div className="border-b p-5"><h2 className="text-lg font-semibold">Items</h2></div>
        {order.items.length === 0 ? <p className="p-5 text-sm opacity-60">No order items found.</p> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Fulfillment</th><th className="px-4 py-3 text-right">Total</th></tr></thead><tbody className="divide-y">{order.items.map((item) => <tr key={item.id}><td className="px-4 py-4"><div className="font-medium">{item.productTitle}</div>{item.variantTitle && <div className="text-xs opacity-60">{item.variantTitle}</div>}</td><td className="px-4 py-4">{item.sku || "—"}</td><td className="px-4 py-4">{item.quantity}</td><td className="px-4 py-4"><State value={item.fulfillmentStatus} /></td><td className="px-4 py-4 text-right">{money(item.totalCents, currency)}</td></tr>)}</tbody></table></div>}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border p-5"><h2 className="mb-4 text-lg font-semibold">Payment session</h2>{order.paymentSession ? <dl className="grid gap-4 sm:grid-cols-2"><Field label="Session"><span className="font-mono text-xs">{order.paymentSession.id}</span></Field><Field label="State"><State value={order.paymentSession.status} /></Field><Field label="Provider">{order.paymentSession.paymentProvider || "Not attached"}</Field><Field label="Provider reference">{order.paymentSession.providerPaymentId || "—"}</Field><Field label="Amount">{money(order.paymentSession.amountCents, order.paymentSession.currency)}</Field></dl> : <p className="text-sm opacity-60">No payment session attached.</p>}</section>
        <section className="rounded-xl border p-5"><h2 className="mb-4 text-lg font-semibold">Shipping</h2><dl className="grid gap-4 sm:grid-cols-2"><Field label="Method">{order.shippingMethod}</Field><Field label="Carrier">{order.shippingCarrier}</Field><Field label="Tracking">{order.trackingNumber}</Field><Field label="Shipped">{order.shippedAt ? new Date(order.shippedAt).toLocaleString() : "—"}</Field><Field label="Delivered">{order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : "—"}</Field></dl><div className="mt-4"><Address value={order.shippingAddress} /></div></section>
      </div>

      <section className="mt-6 rounded-xl border p-5"><h2 className="mb-4 text-lg font-semibold">Escrow</h2>{order.escrow.length === 0 ? <p className="text-sm opacity-60">No escrow entries yet.</p> : <div className="space-y-3">{order.escrow.map((entry) => <div key={entry.id} className="rounded-lg bg-slate-50 p-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div className="font-mono text-xs">{entry.id}</div><State value={entry.status} /></div><div className="mt-2 font-semibold">{money(entry.amountCents, currency)}</div>{entry.releaseReason && <p className="mt-2 text-xs opacity-70">{entry.releaseReason}</p>}{entry.disputeId && <p className="mt-2 text-xs text-amber-700">Dispute: {entry.disputeId}</p>}</div>)}</div>}</section>

      <section className="mt-6 rounded-xl border p-5"><h2 className="mb-4 text-lg font-semibold">Related payouts</h2>{order.payouts.length === 0 ? <p className="text-sm opacity-60">No payout request has claimed this order&apos;s escrow.</p> : <div className="space-y-3">{order.payouts.map((payout) => <div key={payout.id} className="rounded-lg bg-slate-50 p-4 text-sm"><div className="flex flex-wrap justify-between gap-3"><div><div className="font-mono text-xs">{payout.id}</div><div className="mt-2 font-semibold">{money(payout.amountCents, payout.currency)}</div></div><State value={payout.status} /></div>{payout.provider && <p className="mt-2 text-xs opacity-70">{payout.provider} {payout.providerPayoutId ? `· ${payout.providerPayoutId}` : ""}</p>}{payout.failureMessage && <p className="mt-2 text-xs text-red-700">{payout.failureCode || "Failure"}: {payout.failureMessage}</p>}</div>)}</div>}</section>

      <section className="mt-6 rounded-xl border p-5"><h2 className="mb-4 text-lg font-semibold">Recent Admin audit</h2>{order.recentAudit.length === 0 ? <p className="text-sm opacity-60">No Admin interventions recorded for this order.</p> : <div className="space-y-3">{order.recentAudit.map((entry) => <div key={entry.id} className="rounded-lg bg-slate-50 p-3 text-sm"><div className="font-medium">{entry.action}</div><div className="mt-1 text-xs opacity-60">{new Date(entry.timestamp).toLocaleString()} · {entry.adminId}</div></div>)}</div>}</section>
    </div>
  );
}
