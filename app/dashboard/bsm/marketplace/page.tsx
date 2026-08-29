import Link from "next/link";
import { redirect } from "next/navigation";
import WholesaleCatalogue from "@/components/bsm/WholesaleCatalogue";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function BsmWholesaleMarketplacePage() {
  const supabase = await createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user || authError) {
    redirect("/auth?mode=signin&role=bsm&next=/dashboard/bsm/marketplace");
  }

  const { data: business, error: businessError } = await supabase
    .from("profiles_business")
    .select("display_name, verification_status")
    .eq("id", user.id)
    .maybeSingle();

  if (businessError) {
    throw new Error("Unable to verify Business marketplace access");
  }
  if (!business) redirect("/bsm/apply");

  const verified = business.verification_status === "verified";

  return (
    <main className="container mx-auto space-y-8 px-4 py-10">
      <header className="glass-card p-6 md:p-8">
        <p className="text-sm uppercase tracking-wide text-accent-gold">Business sourcing</p>
        <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold">Wholesale marketplace</h1>
            <p className="mt-2 max-w-3xl text-sm opacity-70">
              Source inventory from verified Brands, Suppliers, Manufacturers, Distributors and Wholesalers. B2B prices remain private to eligible Business accounts and are revalidated at cart and checkout.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/bsm" className="luxury-button-outline inline-flex min-h-11 items-center px-4">
              BSM dashboard
            </Link>
            <Link href="/cart" className="luxury-button-outline inline-flex min-h-11 items-center px-4">
              Cart
            </Link>
          </div>
        </div>
      </header>

      {!verified ? (
        <section className="rounded-xl border border-amber-400/35 bg-amber-500/10 p-5">
          <h2 className="font-semibold text-accent-gold">Verified Business access required</h2>
          <p className="mt-2 text-sm opacity-75">
            Wholesale prices and sourcing inventory are restricted to verified Business accounts. This protects supplier pricing from public or ordinary Buyer access.
          </p>
          <Link href="/dashboard/verification" className="luxury-button mt-4 inline-flex min-h-11 items-center px-4">
            Complete verification
          </Link>
        </section>
      ) : (
        <WholesaleCatalogue />
      )}
    </main>
  );
}
