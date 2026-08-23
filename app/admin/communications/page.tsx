import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import CommunicationsClient from "./CommunicationsClient";

export const dynamic = "force-dynamic";

export default async function AdminCommunicationsPage() {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/auth/sign-in");
  if (user.app_metadata?.role !== "admin") redirect("/store");

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm underline opacity-70">← Operations</Link>
          <h1 className="mt-3 text-3xl font-bold">Content & Notifications</h1>
          <p className="mt-2 max-w-3xl text-sm opacity-70">
            Publish EntizNetStore-controlled pages and send targeted in-app notifications through audited trusted operations.
          </p>
        </div>
      </div>
      <CommunicationsClient />
    </div>
  );
}
