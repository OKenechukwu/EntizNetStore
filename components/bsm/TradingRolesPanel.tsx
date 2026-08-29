"use client";

import { useEffect, useMemo, useState } from "react";

type TradingRole =
  | "brand"
  | "supplier"
  | "manufacturer"
  | "distributor"
  | "wholesaler"
  | "retailer"
  | "other";

type RoleResponse = {
  roles?: Array<{ role: TradingRole; isPrimary: boolean }>;
  error?: string;
};

const roleOptions: Array<{ value: TradingRole; label: string; description: string }> = [
  { value: "brand", label: "Brand", description: "Owns or manages a product brand." },
  { value: "supplier", label: "Supplier", description: "Supplies goods to other businesses." },
  { value: "manufacturer", label: "Manufacturer", description: "Produces goods for wholesale or distribution." },
  { value: "distributor", label: "Distributor", description: "Distributes products across channels or regions." },
  { value: "wholesaler", label: "Wholesaler", description: "Sells products in business-scale quantities." },
  { value: "retailer", label: "Retailer", description: "Purchases inventory for resale to shoppers." },
  { value: "other", label: "Other business", description: "Uses another legitimate marketplace trading model." },
];

async function readJson(response: Response): Promise<RoleResponse> {
  return response.json().catch(() => ({}));
}

export default function TradingRolesPanel() {
  const [selected, setSelected] = useState<TradingRole[]>([]);
  const [primary, setPrimary] = useState<TradingRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/bsm/trading-roles", { cache: "no-store" });
        const payload = await readJson(response);
        if (!response.ok) throw new Error(payload.error || "Unable to load trading roles");
        if (!active) return;
        const roles = payload.roles || [];
        setSelected(roles.map((entry) => entry.role));
        setPrimary(roles.find((entry) => entry.isPrimary)?.role || roles[0]?.role || null);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load trading roles");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const orderedRoles = useMemo(() => {
    if (!primary || !selected.includes(primary)) return selected;
    return [primary, ...selected.filter((role) => role !== primary)];
  }, [primary, selected]);

  const toggleRole = (role: TradingRole) => {
    setNotice(null);
    setSelected((current) => {
      if (current.includes(role)) {
        const next = current.filter((entry) => entry !== role);
        if (primary === role) setPrimary(next[0] || null);
        return next;
      }
      const next = [...current, role];
      if (!primary) setPrimary(role);
      return next;
    });
  };

  const save = async () => {
    if (orderedRoles.length === 0) {
      setError("Select at least one business trading role.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/bsm/trading-roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: orderedRoles }),
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.error || "Unable to save trading roles");
      setNotice("Trading roles saved. Your primary role is used as the compatibility business classification.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save trading roles");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="glass-card p-6" aria-labelledby="bsm-trading-roles-heading">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent-gold">Business identity</p>
        <h2 id="bsm-trading-roles-heading" className="mt-1 font-serif text-2xl font-bold">Trading roles</h2>
        <p className="mt-2 text-sm opacity-70">
          A Business can operate in multiple capacities. The primary role is a compatibility label, not a permanent single-role restriction.
        </p>
      </div>

      {error ? <div role="alert" className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div> : null}
      {notice ? <div role="status" className="mb-4 rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</div> : null}

      {loading ? (
        <p className="text-sm opacity-70">Loading trading roles…</p>
      ) : (
        <div className="space-y-3">
          {roleOptions.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <div key={option.value} className="rounded-xl border border-white/10 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRole(option.value)}
                      className="mt-1 h-4 w-4"
                    />
                    <span>
                      <span className="block font-semibold">{option.label}</span>
                      <span className="mt-1 block text-xs opacity-65">{option.description}</span>
                    </span>
                  </label>
                  {checked ? (
                    <label className="flex items-center gap-2 text-xs font-medium text-accent-gold">
                      <input
                        type="radio"
                        name="primary-trading-role"
                        checked={primary === option.value}
                        onChange={() => setPrimary(option.value)}
                      />
                      Primary
                    </label>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={loading || saving || selected.length === 0}
        className="luxury-button mt-5 min-h-11 px-5 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save trading roles"}
      </button>
    </section>
  );
}
