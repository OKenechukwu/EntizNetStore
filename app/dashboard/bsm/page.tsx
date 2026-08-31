import Link from "next/link";
import { redirect } from "next/navigation";
import TradingRolesPanel from "@/components/bsm/TradingRolesPanel";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function BusinessDashboardPage() {
  const supabase = await createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) redirect("/auth?mode=signin&role=bsm&next=/dashboard/bsm");

  const [{ data: business }, { data: seller }] = await Promise.all([
    supabase
      .from("profiles_business")
      .select("display_name, business_kind, verification_status, website, country")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles_seller")
      .select("verification_status")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (!business) redirect("/bsm/apply");

  const isVerified =
    business.verification_status === "verified" && seller?.verification_status === "verified";

  return (
    <div className="container mx-auto space-y-8 px-4 py-10">
      <header className="glass-card p-6 md:p-8">
        <p className="mb-2 text-sm uppercase tracking-wide text-accent-gold">Business / BSM</p>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold">{business.display_name}</h1>
            <p className="mt-2 capitalize opacity-70">{business.business_kind}</p>
          </div>
          <span className="w-fit rounded-full border border-accent-gold/30 px-3 py-1 text-sm capitalize text-accent-gold">
            {business.verification_status.replace("_", " ")}
          </span>
        </div>
      </header>

      {!seller && (
        <section className="rounded-xl border border-red-300/40 bg-red-50/10 p-5">
          <h2 className="font-semibold text-red-300">Seller capability needs recovery</h2>
          <p className="mt-2 text-sm opacity-75">
            This Business profile predates the canonical BSM model. Finish the safe upgrade to attach Seller capability and business-grade KYC.
          </p>
          <Link href="/bsm/apply" className="luxury-button mt-4 inline-flex min-h-11 items-center px-4">
            Finish BSM setup
          </Link>
        </section>
      )}

      {!isVerified && seller && (
        <section className="rounded-xl border border-amber-300/40 bg-amber-50/10 p-5">
          <h2 className="font-semibold text-accent-gold">Business verification required</h2>
          <p className="mt-2 text-sm opacity-75">
            Your BSM account includes Buyer and Seller capabilities. Complete business-grade KYC before publishing products or accessing private wholesale pricing.
          </p>
          <Link href="/dashboard/verification" className="luxury-button mt-4 inline-flex min-h-11 items-center px-4">
            Complete verification
          </Link>
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <section className="glass-card p-6">
          <h2 className="mb-3 font-serif text-xl font-bold text-accent-gold">Wholesale marketplace</h2>
          <p className="mb-5 text-sm opacity-75">
            Source private B2B inventory from verified Brands, Suppliers, Manufacturers, Distributors and Wholesalers.
          </p>
          <Link href="/dashboard/bsm/marketplace" className="luxury-button inline-flex min-h-11 items-center px-4">
            Source inventory
          </Link>
        </section>

        <section className="glass-card p-6">
          <h2 className="mb-3 font-serif text-xl font-bold text-accent-gold">Wholesale offers</h2>
          <p className="mb-5 text-sm opacity-75">
            Publish MOQ, pack, lead-time, Incoterm and quantity-tier terms against your approved Seller catalogue.
          </p>
          <Link href="/dashboard/bsm/wholesale" className="luxury-button inline-flex min-h-11 items-center px-4">
            Manage offers
          </Link>
        </section>

        <section className="glass-card p-6">
          <h2 className="mb-3 font-serif text-xl font-bold text-accent-gold">Manage products</h2>
          <p className="mb-5 text-sm opacity-75">
            Retail and wholesale use the same canonical products, variants and inventory authority.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/store" className="luxury-button-outline inline-flex min-h-11 items-center px-4">
              Products
            </Link>
            <Link href="/dashboard/store/new" className="luxury-button inline-flex min-h-11 items-center px-4">
              Add product
            </Link>
          </div>
        </section>

        <section className="glass-card p-6">
          <h2 className="mb-3 font-serif text-xl font-bold text-accent-gold">Seller operations</h2>
          <p className="mb-5 text-sm opacity-75">
            Orders, storefront operations and branding continue through the canonical Seller capability.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/seller" className="luxury-button-outline inline-flex min-h-11 items-center px-4">
              Seller dashboard
            </Link>
            <Link href="/dashboard/seller/branding" className="luxury-button-outline inline-flex min-h-11 items-center px-4">
              Branding
            </Link>
          </div>
        </section>
      </div>

      <TradingRolesPanel />

      <section className="glass-card p-6">
        <h2 className="font-serif text-xl font-bold text-accent-gold">One identity, multiple capabilities</h2>
        <p className="mt-3 max-w-4xl text-sm opacity-75">
          BSM is an additive Business capability on the same EntizNetStore identity as Buyer and Seller. Trading roles describe how the Business operates; they never replace the underlying Buyer, Seller or Business authorization boundaries.
        </p>
        <Link href="/store" className="luxury-button-outline mt-5 inline-flex min-h-11 items-center px-4">
          Browse retail marketplace
        </Link>
      </section>
    </div>
  );
}
