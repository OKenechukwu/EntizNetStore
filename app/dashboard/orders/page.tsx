import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import SellerOrderActions from "@/components/seller/SellerOrderActions";
import Price from "@/components/common/Price";
import OrderFulfillmentTimeline, {
  type OrderFulfillmentEvent,
} from "@/components/orders/OrderFulfillmentTimeline";

export default async function SellerOrdersPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const { data: seller } = await supabase
    .from("profiles_seller")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!seller) redirect("/dashboard");

  // Keep the base read deployable against the pre-ledger schema. The separate
  // event read doubles as the UI authority-readiness probe: if the migration is
  // not visible yet, existing order state remains readable but mutation controls
  // are suppressed rather than falling through to the legacy RPC implementation.
  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, payment_status, fulfillment_status, total_cents, shipping_carrier, tracking_number, shipped_at, delivered_at, created_at, order_items(id, product_title, variant_title, quantity, total_cents, requires_shipping)",
    )
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  const eventsByOrder = new Map<string, OrderFulfillmentEvent[]>();
  let fulfillmentAuthorityReady = true;
  if (!error && orders?.length) {
    const { data: fulfillmentEvents, error: fulfillmentEventsError } = await supabase
      .from("order_fulfillment_events")
      .select(
        "id, order_id, from_status, to_status, fulfillment_status, shipping_carrier, tracking_number, occurred_at",
      )
      .in(
        "order_id",
        orders.map((order) => order.id),
      )
      .order("occurred_at", { ascending: true });

    if (fulfillmentEventsError) {
      fulfillmentAuthorityReady = false;
    } else {
      for (const event of fulfillmentEvents ?? []) {
        const timelineEvent: OrderFulfillmentEvent = {
          id: event.id,
          from_status: event.from_status,
          to_status: event.to_status,
          fulfillment_status: event.fulfillment_status,
          shipping_carrier: event.shipping_carrier,
          tracking_number: event.tracking_number,
          occurred_at: event.occurred_at,
        };
        const list = eventsByOrder.get(event.order_id) ?? [];
        list.push(timelineEvent);
        eventsByOrder.set(event.order_id, list);
      }
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Seller Orders</h1>
          <p className="mt-1 text-sm text-foreground/70">
            Fulfill paid orders through the authoritative tracking workflow.
          </p>
        </div>
        <Link href="/dashboard/seller" className="text-sm underline">
          Back to dashboard
        </Link>
      </div>

      {!error && !fulfillmentAuthorityReady && (
        <p
          className="mb-4 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100"
          role="status"
        >
          Fulfillment updates are temporarily unavailable while the tracking authority is being prepared. Existing order status remains visible and no order state has been changed.
        </p>
      )}

      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-200" role="alert">
          Unable to load seller orders right now. Please refresh and try again.
        </div>
      ) : !orders?.length ? (
        <div className="rounded-xl border border-border p-10 text-center text-foreground/70">
          No customer orders yet.
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const events = eventsByOrder.get(order.id) ?? [];
            const requiresShipping = (order.order_items ?? []).some(
              (item) => item.requires_shipping !== false,
            );
            return (
              <article key={order.id} className="rounded-xl border border-border bg-background p-5 text-foreground">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <h2 className="font-semibold">{order.order_number}</h2>
                    <p className="text-xs text-foreground/60">
                      {order.created_at ? new Date(order.created_at).toLocaleString() : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      <Price amount={Number(order.total_cents)} cents />
                    </p>
                    <p className="text-xs uppercase text-foreground/60">
                      {order.payment_status} · {order.status}
                    </p>
                  </div>
                </div>

                <ul className="divide-y divide-border">
                  {(order.order_items ?? []).map((item) => (
                    <li key={item.id} className="flex justify-between gap-4 py-3 text-sm">
                      <span>
                        {item.product_title}
                        {item.variant_title ? ` — ${item.variant_title}` : ""} × {item.quantity}
                      </span>
                      <Price amount={Number(item.total_cents)} cents />
                    </li>
                  ))}
                </ul>

                <p className="pt-2 text-xs text-foreground/60">
                  Fulfillment: {order.fulfillment_status}
                </p>
                <OrderFulfillmentTimeline
                  events={events}
                  legacy={{
                    status: order.status || order.fulfillment_status || "pending",
                    shippedAt: order.shipped_at,
                    deliveredAt: order.delivered_at,
                    shippingCarrier: order.shipping_carrier,
                    trackingNumber: order.tracking_number,
                  }}
                />
                {fulfillmentAuthorityReady && (
                  <SellerOrderActions
                    orderId={order.id}
                    status={order.status || "pending"}
                    paymentStatus={order.payment_status || "pending"}
                    requiresShipping={requiresShipping}
                  />
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
