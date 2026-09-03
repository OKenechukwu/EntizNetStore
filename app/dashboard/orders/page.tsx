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

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, payment_status, fulfillment_status, total_cents, shipping_carrier, tracking_number, shipped_at, delivered_at, created_at, order_items(id, product_title, variant_title, quantity, total_cents, requires_shipping), order_fulfillment_events(id, from_status, to_status, fulfillment_status, shipping_carrier, tracking_number, occurred_at)",
    )
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

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
            const events = (order.order_fulfillment_events ?? []) as OrderFulfillmentEvent[];
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
                <SellerOrderActions
                  orderId={order.id}
                  status={order.status || "pending"}
                  paymentStatus={order.payment_status || "pending"}
                  requiresShipping={requiresShipping}
                />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
