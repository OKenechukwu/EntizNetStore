"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RefundReviewAction({ refundRequestId }: { refundRequestId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function review(decision: "approved" | "rejected") {
    if (decision === "rejected" && !notes.trim()) {
      setError("Rejection notes are required.");
      return;
    }
    setBusy(decision);
    setError(null);
    try {
      const response = await fetch("/api/admin/refunds/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundRequestId, decision, notes }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to review refund request");
      setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to review refund request");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-w-[260px] space-y-2">
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        maxLength={10000}
        rows={2}
        placeholder="Admin review notes"
        className="w-full rounded-md border px-2 py-1.5 text-xs"
      />
      <div className="flex gap-2">
        <button onClick={() => void review("approved")} disabled={busy !== null} className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
          {busy === "approved" ? "Approving…" : "Approve"}
        </button>
        <button onClick={() => void review("rejected")} disabled={busy !== null} className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
          {busy === "rejected" ? "Rejecting…" : "Reject"}
        </button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
