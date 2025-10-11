"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createRFQ } from "./actions";

export default function NewRFQPage() {
  const search = useSearchParams();
  const router = useRouter();
  const [bsmName, setBsmName] = useState<string>("");

  const bsm = search.get("bsm") || "";

  useEffect(() => {
    (async () => {
      if (!bsm) return;
      const res = await fetch(`/api/bsm/search?q=`);
      const json = await res.json();
      const match = (json.items || []).find((x: any) => x.id === bsm);
      if (match) setBsmName(match.company_name);
    })();
  }, [bsm]);

  async function onSubmit(form: HTMLFormElement) {
    const fd = new FormData(form);
    fd.set("bsm_id", bsm);
    try {
      await createRFQ(fd);
      alert("RFQ sent ✅");
      router.push("/dashboard/vendor/rfq");
    } catch (e: any) {
      alert(e.message || "Failed to create RFQ");
    }
  }

  return (
    <div className="max-w-2xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Request For Quotation</h1>
      {bsm && (
        <div className="text-sm">
          To: <b>{bsmName || bsm}</b>
        </div>
      )}

      <form action={onSubmit as any} className="space-y-4">
        <input type="hidden" name="bsm_id" value={bsm} />
        <label className="block">
          <span className="text-sm">Title *</span>
          <input
            name="title"
            className="input input-bordered w-full"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm">Details</span>
          <textarea
            name="details"
            className="textarea textarea-bordered w-full"
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-sm">Quantity *</span>
            <input
              name="quantity"
              type="number"
              min={1}
              className="input input-bordered w-full"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm">Target price (optional)</span>
            <input
              name="target_price"
              type="number"
              className="input input-bordered w-full"
            />
          </label>
          <label className="block">
            <span className="text-sm">Currency</span>
            <input
              name="currency"
              defaultValue="USD"
              className="input input-bordered w-full"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm">Delivery terms (Incoterms, location)</span>
          <input
            name="delivery_terms"
            className="input input-bordered w-full"
            placeholder="FOB Shenzhen, CIF Hamburg..."
          />
        </label>

        <label className="block">
          <span className="text-sm">Delivery deadline</span>
          <input
            name="delivery_deadline"
            type="date"
            className="input input-bordered w-full"
          />
        </label>

        <button className="btn btn-primary" type="submit">
          Send RFQ
        </button>
      </form>
    </div>
  );
}
