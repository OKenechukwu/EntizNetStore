import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import ProductModerationQueue from "@/components/admin/ProductModerationQueue";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) redirect("/auth/sign-in");
  if (user.app_metadata?.role !== "admin") redirect("/store");

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm opacity-65 hover:opacity-100">← Admin home</Link>
          <h1 className="mt-2 text-3xl font-bold">Product Moderation</h1>
          <p className="mt-2 max-w-2xl text-sm opacity-70">
            Review Seller catalogue submissions before they can appear in the public marketplace.
            Approval publishes the current revision; any later Seller edit automatically requires a new review.
          </p>
        </div>
      </div>
      <ProductModerationQueue />
    </main>
  );
}
