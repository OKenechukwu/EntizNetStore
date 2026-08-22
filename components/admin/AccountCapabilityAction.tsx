"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Capability = "buyer" | "seller" | "business";
type Status = "active" | "suspended";

export default function AccountCapabilityAction({
  userId,
  capability,
  status,
}: {
  userId: string;
  capability: Capability;
  status: Status;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const nextStatus: Status = status === "active" ? "suspended" : "active";

  async function submit() {
    let reason: string | null = null;
    if (nextStatus === "suspended") {
      reason = window.prompt(`Reason for suspending ${capability} capability:`)?.trim() || null;
      if (!reason) return;
    } else if (!window.confirm(`Restore ${capability} capability for this account?`)) {
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/admin/accounts/capability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, capability, status: nextStatus, reason }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to update account capability");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to update account capability");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={submit}
      className={`rounded-md px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
        status === "active"
          ? "border border-red-300 text-red-700 hover:bg-red-50"
          : "border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
      }`}
    >
      {pending ? "Working…" : status === "active" ? `Suspend ${capability}` : `Restore ${capability}`}
    </button>
  );
}
