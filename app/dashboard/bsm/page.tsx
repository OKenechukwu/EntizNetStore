import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';

export default async function BusinessDashboardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth?mode=signin&role=bsm');

  const [{ data: business }, { data: seller }] = await Promise.all([
    supabase
      .from('profiles_business')
      .select('display_name, business_kind, verification_status, website, country')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('profiles_seller')
      .select('verification_status')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

  if (!business) redirect('/bsm/apply');
  if (!seller) redirect('/api/onboarding/business');

  const isVerified =
    business.verification_status === 'verified' && seller.verification_status === 'verified';

  return (
    <div className="container mx-auto px-4 py-10 space-y-8">
      <div className="glass-card p-6 md:p-8">
        <p className="text-sm uppercase tracking-wide text-accent-gold mb-2">Business / BSM</p>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold">{business.display_name}</h1>
            <p className="mt-2 opacity-70 capitalize">{business.business_kind}</p>
          </div>
          <span className="w-fit rounded-full border border-accent-gold/30 px-3 py-1 text-sm capitalize text-accent-gold">
            {business.verification_status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {!isVerified && (
        <div className="rounded-xl border border-amber-300/40 bg-amber-50/10 p-5">
          <h2 className="font-semibold text-accent-gold">Business verification required</h2>
          <p className="mt-2 text-sm opacity-75">
            Your BSM account already includes Buyer and Seller capabilities. Complete business-grade KYC before publishing products publicly.
          </p>
          <Link href="/dashboard/verification" className="luxury-button inline-block mt-4 px-4 py-2">
            Complete verification
          </Link>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="glass-card p-6">
          <h2 className="font-serif text-xl font-bold text-accent-gold mb-3">Multi-capability account</h2>
          <p className="opacity-75 mb-5">
            BSM is a distinct Business capability attached to the same identity as Buyer and Seller. No second account or role switching is required.
          </p>
          <Link href="/store" className="luxury-button-outline inline-block px-4 py-2">
            Browse marketplace
          </Link>
        </div>

        <div className="glass-card p-6">
          <h2 className="font-serif text-xl font-bold text-accent-gold mb-3">Manage products</h2>
          <p className="opacity-75 mb-5">
            Create drafts immediately. Public publishing remains gated by the shared Seller/Business verification state.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/store" className="luxury-button-outline inline-block px-4 py-2">
              Products
            </Link>
            <Link href="/dashboard/store/new" className="luxury-button inline-block px-4 py-2">
              Add product
            </Link>
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="font-serif text-xl font-bold text-accent-gold mb-3">Seller operations</h2>
          <p className="opacity-75 mb-5">
            Orders, storefront operations and seller tools use the same canonical Seller capability provisioned with your BSM account.
          </p>
          <Link href="/dashboard/seller" className="luxury-button-outline inline-block px-4 py-2">
            Seller dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
