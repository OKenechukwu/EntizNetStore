import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import BrandingUploader from '@/components/seller/BrandingUploader';

export default async function SellerBrandingPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect('/auth/sign-in');

  const { data: seller } = await supabase
    .from('profiles_seller')
    .select('storefront_name, logo_url, banner_url')
    .eq('id', user.id)
    .maybeSingle();

  if (!seller) redirect('/seller/apply');

  return (
    <main className="container mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-accent-gold">Seller branding</p>
          <h1 className="mt-2 font-serif text-3xl font-bold">{seller.storefront_name}</h1>
          <p className="mt-2 max-w-2xl opacity-70">
            Upload the public logo and banner used by your EntizNetStore storefront. Storage ownership and file signatures are validated server-side.
          </p>
        </div>
        <Link href="/dashboard/seller" className="luxury-button-outline px-4 py-2">
          Back to dashboard
        </Link>
      </div>

      <BrandingUploader initialLogo={seller.logo_url} initialBanner={seller.banner_url} />
    </main>
  );
}
