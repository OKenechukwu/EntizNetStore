import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import CapabilityApplicationForm from '@/components/onboarding/CapabilityApplicationForm';

export default async function SellerApplyPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth?mode=signin&role=seller');

  const { data: seller } = await supabase
    .from('profiles_seller')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (seller) redirect('/dashboard/seller');

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-3">Become a Seller</h1>
      <p className="text-foreground/70 mb-8">
        Add Seller to your existing EntizNetStore account. You keep your Buyer capability and use the same secure identity.
      </p>
      <div className="rounded-lg border border-white/10 bg-card p-6 md:p-8">
        <CapabilityApplicationForm kind="seller" />
      </div>
    </div>
  );
}
