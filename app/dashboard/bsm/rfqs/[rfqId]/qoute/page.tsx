// app/dashboard/bsm/rfqs/[rfqId]/quote/page.tsx
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { getRFQ } from "@/app/dashboard/bsm/vendors/actions";
import QuoteForm from "@/components/bsm/QuoteForm";

export default async function Page({ params }: { params: { rfqId: string } }) {
  const gate = await requireRole(["brand", "supplier", "manufacturer", "bsm"]);
  if (!gate.ok) notFound();

  const rfq = await getRFQ(params.rfqId).catch(() => null);
  if (!rfq) notFound();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reply with Quotation</h1>
        <p className="text-sm text-muted-foreground">
          RFQ: {rfq.title} • Status: {rfq.status}
        </p>
      </div>
      <QuoteForm
        rfqId={rfq.id}
        items={[
          {
            id: rfq.id,
            name: rfq.title ?? null,
            spec: rfq.details ?? null,
            quantity: rfq.quantity ?? null,
            unit: null,
          },
        ]}
      />
    </div>
  );
}
