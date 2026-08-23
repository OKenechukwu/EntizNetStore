"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function PayoutPrepareAction({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [sellerId, setSellerId] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled) return;
    const seller = sellerId.trim();
    if (!seller) return;

    setPending(true);
    try {
      const response = await fetch("/api/admin/finance/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId: seller, idempotencyKey: crypto.randomUUID() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to prepare payout");
      setSellerId("");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to prepare payout");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <input
        value={sellerId}
        onChange={(event) => setSellerId(event.target.value)}
        placeholder="Verified Seller UUID"
        className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm disabled:bg-slate-100"
        required
        disabled={!enabled || pending}
      />
      <button
        type="submit"
        disabled={!enabled || pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Preparing…" : "Prepare eligible payout"}
      </button>
    </form>
  );
}

export function PayoutCancelAction({ payoutRequestId }: { payoutRequestId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function cancel() {
    const reason = window.prompt("Reason for cancelling this payout request:")?.trim();
    if (!reason) return;

    setPending(true);
    try {
      const response = await fetch("/api/admin/finance/payouts/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoutRequestId, reason }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to cancel payout");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to cancel payout");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={cancel}
      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Cancelling…" : "Cancel payout"}
    </button>
  );
}
