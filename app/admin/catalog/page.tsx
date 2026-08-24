import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import CatalogGovernancePanel from "./CatalogGovernancePanel";

export const dynamic = "force-dynamic";

export default async function AdminCatalogPage() {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/auth/sign-in");
  if (user.app_metadata?.role !== "admin") redirect("/store");

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8">
        <Link href="/admin" className="text-sm opacity-65 hover:opacity-100">← Operations</Link>
        <h1 className="mt-3 text-3xl font-bold">Catalogue Governance</h1>
        <p className="mt-2 max-w-3xl text-sm opacity-70">
          Manage category hierarchy, explicit adult/general classification and brand verification/retirement. All mutations use trusted audited server boundaries; referenced taxonomy cannot be destructively deleted.
        </p>
      </div>
      <CatalogGovernancePanel />
    </div>
  );
}
