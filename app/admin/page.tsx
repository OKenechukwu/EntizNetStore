// app/admin/page.tsx
//
// Canonical admin landing page. Server-side authorization only: admin
// privilege comes from trusted app_metadata (set via the Supabase Admin
// API / service role) — the same rule enforced by lib/auth/requireAdmin.ts
// for API routes — never from client-mutable user_metadata, query
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

  if (error || !user) {
    redirect("/auth/sign-in");
  }
  if (user.app_metadata?.role !== "admin") {
    redirect("/store");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">EntizNetStore Admin</h1>
      <p className="opacity-70 mb-8">
        Signed in as {user.email ?? user.id} (admin)
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Link
          href="/admin/kyc"
          className="block rounded-xl border p-6 transition hover:shadow-md"
        >
          <h2 className="text-lg font-semibold mb-1">KYC Review</h2>
          <p className="text-sm opacity-70">
            Review pending seller verification requests and documents.
          </p>
        </Link>

        <Link
          href="/admin/i18n/seed"
          className="block rounded-xl border p-6 transition hover:shadow-md"
        >
          <h2 className="text-lg font-semibold mb-1">Translation Seeding</h2>
          <p className="text-sm opacity-70">
            Utility to seed i18n translations (requires the admin seed token).
          </p>
        </Link>
      </div>
    </div>
  );
}
