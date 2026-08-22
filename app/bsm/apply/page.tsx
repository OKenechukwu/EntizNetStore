import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import CapabilityApplicationForm from '@/components/onboarding/CapabilityApplicationForm';

export default async function BSMApplyPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth?mode=signin&role=bsm');

  const [{ data: business }, { data: seller }] = await Promise.all([
    supabase
      .from('profiles_business')
      .select('id')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('profiles_seller')
      .select('id')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

  // Fully provisioned BSM accounts go to their dashboard. A historical/partial
  // Business projection without Seller stays here so idempotent onboarding can
  // repair the missing sell capability safely.
  if (business && seller) redirect('/dashboard/bsm');

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-3">Brands, Suppliers & Manufacturers</h1>
      <p className="text-foreground/70 mb-8">
        {business
          ? 'Finish upgrading this Business profile into the canonical sell-capable BSM account. Your existing Business identity is preserved while the missing Seller capability and business KYC are initialized.'
          : 'Create a sell-capable Business/BSM account on your existing identity. Buyer stays active, while Seller and Business capabilities are added together and protected by business-grade KYC.'}
      </p>
      <div className="rounded-lg border border-white/10 bg-card p-6 md:p-8">
        <CapabilityApplicationForm kind="business" />
      </div>
    </div>
  );
}
