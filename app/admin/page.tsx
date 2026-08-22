// app/admin/page.tsx
//
// Canonical admin landing page. Server-side authorization only: admin
// privilege comes from trusted app_metadata (set via the Supabase Admin
// API / service role), never from client-mutable user_metadata, query
// parameters, or browser state.
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminLandingPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/auth/sign-in");
  if (user.app_metadata?.role !== "admin") redirect("/store");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold">EntizNetStore Admin</h1>
      <p className="mb-8 opacity-70">
        Signed in as {user.email ?? user.id} (admin)
      </p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/kyc" className="block rounded-xl border p-6 transition hover:shadow-md">
          <h2 className="mb-1 text-lg font-semibold">KYC Review</h2>
          <p className="text-sm opacity-70">Review pending Seller verification requests and documents.</p>
        </Link>

        <Link href="/admin/products" className="block rounded-xl border p-6 transition hover:shadow-md">
          <h2 className="mb-1 text-lg font-semibold">Product Moderation</h2>
          <p className="text-sm opacity-70">Approve or reject Seller catalogue submissions before publication.</p>
        </Link>

        <Link href="/admin/i18n/seed" className="block rounded-xl border p-6 transition hover:shadow-md">
          <h2 className="mb-1 text-lg font-semibold">Translation Seeding</h2>
          <p className="text-sm opacity-70">Utility to seed i18n translations (requires the admin seed token).</p>
        </Link>
      </div>
    </div>
  );
}
