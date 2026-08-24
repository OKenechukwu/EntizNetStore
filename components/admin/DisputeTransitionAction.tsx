"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DisputeStatus = "open" | "under_review" | "resolved_buyer" | "resolved_seller" | "closed";
type NextStatus = "under_review" | "resolved_buyer" | "resolved_seller" | "closed";

export default function DisputeTransitionAction({ disputeId, status }: { disputeId: string; status: DisputeStatus }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<NextStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const options: Array<{ value: NextStatus; label: string }> =
    status === "resolved_buyer"
      ? []
      : status === "resolved_seller"
        ? [{ value: "closed", label: "Close Seller-favoring case" }]
        : status === "closed"
          ? []
          : [
              ...(status === "open" ? [{ value: "under_review" as const, label: "Start review" }] : []),
              { value: "resolved_buyer", label: "Resolve for Buyer" },
              { value: "resolved_seller", label: "Resolve for Seller" },
              { value: "closed", label: "Close case" },
            ];

  async function transition(nextStatus: NextStatus) {
    if (["resolved_buyer", "resolved_seller", "closed"].includes(nextStatus) && !notes.trim()) {
      setError("Resolution notes are required for this action.");
      return;
    }
    setBusy(nextStatus);
    setError(null);
    try {
      const response = await fetch("/api/admin/disputes/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disputeId, status: nextStatus, notes }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to update dispute");
      setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update dispute");
    } finally {
      setBusy(null);
    }
  }

  if (status === "resolved_buyer") {
    return <p className="max-w-xs text-xs font-medium text-amber-700">Buyer resolution recorded. Escrow remains frozen until a trusted provider refund succeeds; this case cannot be manually closed.</p>;
  }
  if (status === "closed") return <span className="text-xs opacity-55">No further transitions</span>;

  return (
    <div className="min-w-[280px] space-y-2">
      <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={10000} rows={2} placeholder="Operational / resolution notes" className="w-full rounded-md border px-2 py-1.5 text-xs" />
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => void transition(option.value)}
            disabled={busy !== null}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${option.value === "resolved_buyer" ? "bg-sky-700" : option.value === "resolved_seller" ? "bg-emerald-700" : option.value === "closed" ? "bg-slate-700" : "bg-amber-700"}`}
          >
            {busy === option.value ? "Updating…" : option.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
