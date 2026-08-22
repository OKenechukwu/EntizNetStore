import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';

export default async function BusinessDashboardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth?mode=signin&role=bsm');

  const { data: business } = await supabase
    .from('profiles_business')
    .select('display_name, business_kind, verification_status, website, country')
    .eq('id', user.id)
    .maybeSingle();
  if (!business) redirect('/bsm/apply');

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

      <div className="grid gap-6 md:grid-cols-2">
        <div className="glass-card p-6">
          <h2 className="font-serif text-xl font-bold text-accent-gold mb-3">Business capability</h2>
          <p className="opacity-75 mb-5">
            This capability is independent from Seller and Buyer. The same account may hold all three without changing permanent roles.
          </p>
          <Link href="/store" className="luxury-button-outline inline-block px-4 py-2">Browse marketplace</Link>
        </div>

        <div className="glass-card p-6">
          <h2 className="font-serif text-xl font-bold text-accent-gold mb-3">Want to sell retail products?</h2>
          <p className="opacity-75 mb-5">
            Add Seller capability separately. Your Business/BSM identity remains attached to the account.
          </p>
          <Link href="/seller/apply" className="luxury-button inline-block px-4 py-2">Add Seller capability</Link>
        </div>
      </div>
    </div>
  );
}
