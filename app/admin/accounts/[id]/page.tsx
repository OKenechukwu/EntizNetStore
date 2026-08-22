import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import AccountCapabilityAction from "@/components/admin/AccountCapabilityAction";

export const dynamic = "force-dynamic";

type CapabilityStatus = "active" | "suspended";

type AccountDetail = {
  userId: string;
  email: string | null;
  authCreatedAt: string;
  lastSignInAt: string | null;
  buyer: null | { displayName: string | null; firstName: string | null; lastName: string | null; country: string | null; phone: string | null; status: CapabilityStatus };
  seller: null | { storefrontName: string; storeSlug: string; verificationStatus: string | null; businessType: string | null; status: CapabilityStatus };
  business: null | { displayName: string; legalName: string | null; businessKind: string; verificationStatus: string; status: CapabilityStatus };
  entiznetLink: null | { entiznetUserId: string; status: string; capabilitiesSnapshot: string[]; capabilitiesVersion: string | null; linkedAt: string; lastSyncedAt: string; revokedAt: string | null; revokedReason: string | null };
  recentCapabilityEvents: Array<{ id: string; capability: string; oldStatus: string; newStatus: string; reason: string | null; actorId: string | null; actorType: string; createdAt: string }>;
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide opacity-55">{label}</dt><dd className="mt-1 break-words text-sm">{value ?? "—"}</dd></div>;
}

function CapabilityCard({ title, capability, userId, data, children }: { title: string; capability: "buyer" | "seller" | "business"; userId: string; data: { status: CapabilityStatus }; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">{title}</h2><p className={`mt-1 text-xs font-medium ${data.status === "active" ? "text-emerald-700" : "text-red-700"}`}>{data.status.toUpperCase()}</p></div>
        <AccountCapabilityAction userId={userId} capability={capability} status={data.status} />
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

export default async function AdminAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/auth/sign-in");
  if (user.app_metadata?.role !== "admin") redirect("/store");

  const { id } = await params;
  const admin = getSupabaseAdmin();
  const { data, error: detailError } = await admin.rpc("admin_get_marketplace_account", {
    p_admin_id: user.id,
    p_target_user_id: id,
  });
  if (detailError || !data) notFound();

  const account = data as AccountDetail;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/admin/accounts" className="text-sm text-sky-700 hover:underline">← Marketplace accounts</Link>
      <div className="mt-3 mb-8">
        <h1 className="text-3xl font-bold">{account.email || "Marketplace account"}</h1>
        <p className="mt-1 font-mono text-xs opacity-55">Store user: {account.userId}</p>
      </div>

      <section className="mb-6 rounded-xl border p-5">
        <h2 className="mb-4 text-lg font-semibold">Identity</h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Email" value={account.email} />
          <Field label="Created" value={new Date(account.authCreatedAt).toLocaleString()} />
          <Field label="Last sign in" value={account.lastSignInAt ? new Date(account.lastSignInAt).toLocaleString() : "Never"} />
        </dl>
      </section>

      <div className="grid gap-6">
        {account.buyer && (
          <CapabilityCard title="Buyer capability" capability="buyer" userId={account.userId} data={account.buyer}>
            <Field label="Display name" value={account.buyer.displayName} />
            <Field label="Name" value={[account.buyer.firstName, account.buyer.lastName].filter(Boolean).join(" ") || "—"} />
            <Field label="Country" value={account.buyer.country} />
            <Field label="Phone" value={account.buyer.phone} />
          </CapabilityCard>
        )}

        {account.seller && (
          <CapabilityCard title="Seller capability" capability="seller" userId={account.userId} data={account.seller}>
            <Field label="Storefront" value={account.seller.storefrontName} />
            <Field label="Public slug" value={account.seller.storeSlug} />
            <Field label="KYC / verification" value={account.seller.verificationStatus} />
            <Field label="Business type" value={account.seller.businessType} />
          </CapabilityCard>
        )}

        {account.business && (
          <CapabilityCard title="Business capability" capability="business" userId={account.userId} data={account.business}>
            <Field label="Display name" value={account.business.displayName} />
            <Field label="Legal name" value={account.business.legalName} />
            <Field label="Business kind" value={account.business.businessKind} />
            <Field label="KYC / verification" value={account.business.verificationStatus} />
          </CapabilityCard>
        )}
      </div>

      <section className="mt-6 rounded-xl border p-5">
        <h2 className="mb-4 text-lg font-semibold">EntizNet link</h2>
        {account.entiznetLink ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="EntizNet user ID" value={<span className="font-mono text-xs">{account.entiznetLink.entiznetUserId}</span>} />
            <Field label="Link status" value={account.entiznetLink.status} />
            <Field label="Capabilities snapshot" value={account.entiznetLink.capabilitiesSnapshot.length ? account.entiznetLink.capabilitiesSnapshot.join(", ") : "None asserted"} />
            <Field label="Capabilities version" value={account.entiznetLink.capabilitiesVersion} />
            <Field label="Linked" value={new Date(account.entiznetLink.linkedAt).toLocaleString()} />
            <Field label="Last synchronized" value={new Date(account.entiznetLink.lastSyncedAt).toLocaleString()} />
            {account.entiznetLink.revokedReason && <Field label="Revocation reason" value={account.entiznetLink.revokedReason} />}
          </dl>
        ) : <p className="text-sm opacity-70">Standalone EntizNetStore account. No EntizNet identity is linked.</p>}
      </section>

      <section className="mt-6 rounded-xl border p-5">
        <h2 className="mb-4 text-lg font-semibold">Capability history</h2>
        {account.recentCapabilityEvents.length === 0 ? <p className="text-sm opacity-70">No suspension/restoration actions recorded.</p> : (
          <div className="space-y-3">
            {account.recentCapabilityEvents.map((event) => (
              <div key={event.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="font-medium">{event.capability}: {event.oldStatus} → {event.newStatus}</div>
                <div className="mt-1 text-xs opacity-65">{new Date(event.createdAt).toLocaleString()} · {event.actorType}{event.actorId ? ` · ${event.actorId}` : ""}</div>
                {event.reason && <p className="mt-2 text-sm">{event.reason}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
