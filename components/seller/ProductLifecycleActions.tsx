"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  productId: string;
  sellerVerified: boolean;
  status: string;
  moderationStatus: string;
};

export default function ProductLifecycleActions({
  productId,
  sellerVerified,
  status,
  moderationStatus,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!sellerVerified || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/seller/products/${productId}/submit`, { method: "POST" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "Unable to submit product");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit product");
    } finally {
      setBusy(false);
    }
  }

  async function publication(active: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/seller/products/${productId}/publication`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "Unable to change publication state");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to change publication state");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-w-[150px] flex-col items-start gap-1.5">
      {moderationStatus === "not_submitted" || moderationStatus === "rejected" ? (
        <button
          type="button"
          disabled={busy || !sellerVerified}
          onClick={() => void submit()}
          className="text-emerald-700 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
        >
          Submit for review
        </button>
      ) : null}
      {moderationStatus === "approved" && status === "active" ? (
        <button type="button" disabled={busy} onClick={() => void publication(false)} className="text-amber-700 hover:underline disabled:opacity-40">
          Unpublish
        </button>
      ) : null}
      {moderationStatus === "approved" && status !== "active" ? (
        <button type="button" disabled={busy} onClick={() => void publication(true)} className="text-emerald-700 hover:underline disabled:opacity-40">
          Republish
        </button>
      ) : null}
      {moderationStatus === "pending" ? <span className="text-xs text-amber-700">Awaiting Admin review</span> : null}
      {error ? <span className="max-w-[220px] text-xs text-red-700">{error}</span> : null}
    </div>
  );
}
