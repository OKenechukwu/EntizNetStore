export type OrderFulfillmentEvent = {
  id: string;
  from_status: string;
  to_status: string;
  fulfillment_status: string;
  shipping_carrier: string | null;
  tracking_number: string | null;
  occurred_at: string;
};

type LegacyState = {
  status: string;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  shippingCarrier?: string | null;
  trackingNumber?: string | null;
};

function titleFor(status: string) {
  if (status === "processing") return "Processing";
  if (status === "shipped") return "Shipped";
  if (status === "delivered") return "Delivered";
  return status.replaceAll("_", " ");
}

function formatTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

export default function OrderFulfillmentTimeline({
  events,
  legacy,
}: {
  events: OrderFulfillmentEvent[];
  legacy: LegacyState;
}) {
  const ordered = [...events].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
  );

  if (!ordered.length) {
    return (
      <section className="mt-4 rounded-lg border border-border bg-white/5 p-4" aria-label="Order tracking timeline">
        <h3 className="text-sm font-semibold">Order tracking</h3>
        <p className="mt-2 text-sm text-foreground/70">
          Current status: <span className="font-medium text-foreground">{titleFor(legacy.status)}</span>
        </p>
        {legacy.shippedAt && (
          <p className="mt-1 text-sm text-foreground/70">Shipped {formatTime(legacy.shippedAt)}</p>
        )}
        {legacy.deliveredAt && (
          <p className="mt-1 text-sm text-foreground/70">Delivered {formatTime(legacy.deliveredAt)}</p>
        )}
        {legacy.trackingNumber && (
          <p className="mt-2 break-words text-sm">
            <span className="font-medium">Tracking:</span>{" "}
            {legacy.shippingCarrier || "Carrier"} · {legacy.trackingNumber}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-lg border border-border bg-white/5 p-4" aria-label="Order tracking timeline">
      <h3 className="text-sm font-semibold">Order tracking</h3>
      <ol className="mt-3 space-y-3">
        {ordered.map((event) => (
          <li key={event.id} className="relative border-l border-border pl-4 text-sm">
            <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-foreground" aria-hidden="true" />
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">{titleFor(event.to_status)}</span>
              <time className="text-xs text-foreground/60" dateTime={event.occurred_at}>
                {formatTime(event.occurred_at)}
              </time>
            </div>
            {event.to_status === "shipped" && event.tracking_number && (
              <p className="mt-1 break-words text-foreground/80">
                {event.shipping_carrier || "Carrier"} · {event.tracking_number}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
