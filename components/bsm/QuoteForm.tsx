'use client';

import { useMemo, useState, useTransition } from 'react';
import { previewTotals, createQuotation } from '@/app/dashboard/bsm/vendors/actions';

type RFQItem = {
  id: string;
  name: string | null;
  spec: string | null;
  quantity: number | null;
  unit: string | null;
};

export default function QuoteForm({
  rfqId,
  items,
}: {
  rfqId: string;
  items: RFQItem[];
}) {
  const [rows, setRows] = useState(
    items.map((it) => ({
      rfq_item_id: it.id,
      qty: it.quantity ?? 1,
      unit_price: 0,
      note: '',
      name: it.name ?? '',
      spec: it.spec ?? '',
      unit: it.unit ?? '',
    })),
  );

  const [currency, setCurrency] = useState('EUR');
  const [shipping, setShipping] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [deliveryDays, setDeliveryDays] = useState(7);
  const [validUntil, setValidUntil] = useState<string>('');
  const [notes, setNotes] = useState('');

  const [calc, setCalc] = useState<null | {
    subtotal: number;
    tax_amount: number;
    discount_amount: number;
    shipping_cost: number;
    total: number;
    currency: string;
  }>(null);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const payload = useMemo(() => {
    return {
      rfq_id: rfqId,
      currency,
      items: rows.map((r) => ({
        rfq_item_id: r.rfq_item_id,
        quantity: Number(r.qty) || undefined,
        unit_price: Number(r.unit_price) || 0,
        note: r.note || undefined,
      })),
      shipping_cost: Number(shipping) || 0,
      discount_amount: Number(discount) || 0,
      tax_percent: Number(tax) || 0,
      delivery_days: Number(deliveryDays) || 7,
      valid_until: validUntil ? new Date(validUntil).toISOString() : undefined,
      notes: notes || undefined,
    };
  }, [rfqId, currency, rows, shipping, discount, tax, deliveryDays, validUntil, notes]);

  const doPreview = () => {
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      try {
        const res = await previewTotals(payload as any);
        if (!res?.ok) throw new Error('Preview failed');
        setCalc({
          subtotal: res.subtotal,
          tax_amount: res.tax_amount,
          discount_amount: res.discount_amount,
          shipping_cost: res.shipping_cost,
          total: res.total,
          currency: res.currency,
        });
      } catch (e: any) {
        setError(e?.message || 'Failed to preview totals.');
      }
    });
  };

  const doSubmit = () => {
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      try {
        const res = await createQuotation(payload as any);
        if (!res?.ok) throw new Error('Create quotation failed');
        setOkMsg(`Quotation sent. #${res.quotation_id} • Total ${res.currency} ${res.total}`);
      } catch (e: any) {
        setError(e?.message || 'Failed to create quotation.');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Items table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3">Item</th>
              <th className="text-left p-3">Spec</th>
              <th className="text-right p-3">RFQ Qty</th>
              <th className="text-right p-3">Quote Qty</th>
              <th className="text-right p-3">Unit Price</th>
              <th className="text-left p-3">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.rfq_item_id} className="border-t">
                <td className="p-3">{r.name}</td>
                <td className="p-3">{r.spec}</td>
                <td className="p-3 text-right">{items[i]?.quantity ?? '-'}</td>
                <td className="p-3 text-right">
                  <input
                    type="number"
                    min={1}
                    value={r.qty}
                    onChange={(e) =>
                      setRows((arr) =>
                        arr.map((x, idx) => (idx === i ? { ...x, qty: Number(e.target.value) } : x)),
                      )
                    }
                    className="w-24 border rounded px-2 py-1 text-right"
                  />
                </td>
                <td className="p-3 text-right">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={r.unit_price}
                    onChange={(e) =>
                      setRows((arr) =>
                        arr.map((x, idx) => (idx === i ? { ...x, unit_price: Number(e.target.value) } : x)),
                      )
                    }
                    className="w-28 border rounded px-2 py-1 text-right"
                  />
                </td>
                <td className="p-3">
                  <input
                    type="text"
                    value={r.note}
                    onChange={(e) =>
                      setRows((arr) =>
                        arr.map((x, idx) => (idx === i ? { ...x, note: e.target.value } : x)),
                      )
                    }
                    className="w-full border rounded px-2 py-1"
                    placeholder="Optional note"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals / meta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex items-center gap-2">
          <span className="w-36 text-sm">Currency</span>
          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            className="border rounded px-2 py-1"
            placeholder="EUR"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="w-36 text-sm">Shipping Cost</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={shipping}
            onChange={(e) => setShipping(Number(e.target.value))}
            className="border rounded px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="w-36 text-sm">Discount Amount</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
            className="border rounded px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="w-36 text-sm">Tax %</span>
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={tax}
            onChange={(e) => setTax(Number(e.target.value))}
            className="border rounded px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="w-36 text-sm">Delivery Days</span>
          <input
            type="number"
            min={1}
            value={deliveryDays}
            onChange={(e) => setDeliveryDays(Number(e.target.value))}
            className="border rounded px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="w-36 text-sm">Valid Until</span>
          <input
            type="datetime-local"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </label>
      </div>

      <div>
        <label className="block text-sm mb-2">Notes (optional)</label>
        <textarea
          className="w-full border rounded px-3 py-2 min-h-[100px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Terms, packaging, MOQ, warranty, etc."
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button onClick={doPreview} disabled={isPending} className="px-4 py-2 rounded bg-muted hover:bg-muted/80">
          {isPending ? 'Calculating...' : 'Preview totals'}
        </button>
        <button onClick={doSubmit} disabled={isPending} className="px-4 py-2 rounded bg-primary text-primary-foreground">
          {isPending ? 'Sending...' : 'Send quotation'}
        </button>
      </div>

      {/* Feedback */}
      {calc && (
        <div className="border rounded p-4">
          <h3 className="font-medium mb-2">Preview</h3>
          <ul className="text-sm space-y-1">
            <li>Subtotal: {calc.currency} {calc.subtotal.toFixed(2)}</li>
            <li>Tax: {calc.currency} {calc.tax_amount.toFixed(2)}</li>
            <li>Discount: {calc.currency} {calc.discount_amount.toFixed(2)}</li>
            <li>Shipping: {calc.currency} {calc.shipping_cost.toFixed(2)}</li>
            <li className="font-semibold">Total: {calc.currency} {calc.total.toFixed(2)}</li>
          </ul>
        </div>
      )}
      {okMsg && <p className="text-green-600 text-sm">{okMsg}</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
