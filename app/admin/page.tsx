// app/admin/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const operations = [
  {
    href: "/admin/accounts",
    title: "Marketplace Accounts",
    description: "Search Buyers, Sellers and Businesses, inspect EntizNet links, and suspend or restore capabilities independently.",
  },
  {
    href: "/admin/orders",
    title: "Orders & Payments",
    description: "Search global orders and inspect Buyer/Seller, payment, fulfillment, escrow, payout and audit state from one operational view.",
  },
  {
    href: "/admin/disputes",
    title: "Disputes",
    description: "Review Buyer/Seller disputes, preserve escrow holds, record decisions and route Buyer-favoring outcomes into refunds safely.",
  },
  {
    href: "/admin/refunds",
    title: "Refunds",
    description: "Review refund requests separately from provider execution and surface payout blocks before money moves.",
  },
  {
    href: "/admin/finance",
    title: "Finance & Transactions",
    description: "Monitor GMV, platform revenue, refunds, escrow and payout exposure with global transaction search.",
  },
  {
    href: "/admin/audit",
    title: "Operational Audit Log",
    description: "Search trusted Admin actions across accounts, KYC, moderation, disputes, refunds, payouts and other operations.",
  },
  {
    href: "/admin/kyc",
    title: "KYC Review",
    description: "Review pending Seller verification requests and documents.",
  },
  {
    href: "/admin/products",
    title: "Product Moderation",
    description: "Approve or reject Seller catalogue submissions before publication.",
  },
] as const;

export default async function AdminLandingPage() {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/auth/sign-in");
  if (user.app_metadata?.role !== "admin") redirect("/store");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">EntizNetStore Operations</h1>
        <p className="mt-2 opacity-70">Signed in as {user.email ?? user.id} · trusted Admin</p>
        <p className="mt-2 max-w-3xl text-sm opacity-65">Combined M3 is moving ordinary marketplace operations into audited Store controls so production staff do not need direct Supabase access.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {operations.map((operation) => (
          <Link key={operation.href} href={operation.href} className="block rounded-xl border p-6 transition hover:shadow-md">
            <h2 className="mb-1 text-lg font-semibold">{operation.title}</h2>
            <p className="text-sm opacity-70">{operation.description}</p>
          </Link>
        ))}

        <Link href="/admin/i18n/seed" className="block rounded-xl border border-dashed p-6 transition hover:shadow-md">
          <h2 className="mb-1 text-lg font-semibold">Translation Seeding</h2>
          <p className="text-sm opacity-70">Restricted utility for seeding i18n translations. This is not a routine marketplace operation.</p>
        </Link>
      </div>
    </div>
  );
}
