import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import CapabilityApplicationForm from '@/components/onboarding/CapabilityApplicationForm';

export default async function BSMApplyPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth?mode=signin&role=bsm');

  const { data: business } = await supabase
    .from('profiles_business')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (business) redirect('/dashboard/bsm');

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-3">Brands, Suppliers & Manufacturers</h1>
      <p className="text-foreground/70 mb-8">
        Add a Business/BSM capability to the same account you already use to shop or sell.
      </p>
      <div className="rounded-lg border border-white/10 bg-card p-6 md:p-8">
        <CapabilityApplicationForm kind="business" />
      </div>
    </div>
  );
}
