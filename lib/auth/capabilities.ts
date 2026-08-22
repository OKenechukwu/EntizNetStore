import { createServerSupabase } from '@/lib/supabase/server';
import type {
  BusinessVerificationStatus,
  Capabilities,
  SellerVerificationStatus,
} from './capabilityRouting';

/**
 * Resolve the current account's additive capabilities from server-trusted
 * identity. RLS limits each private profile lookup to the authenticated user.
 */
export async function resolveCapabilities(): Promise<Capabilities | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const [buyerRes, sellerRes, businessRes] = await Promise.all([
    supabase.from('profiles_buyer').select('id').eq('id', user.id).maybeSingle(),
    supabase
      .from('profiles_seller')
      .select('id, verification_status')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('profiles_business')
      .select('id, verification_status')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

  const isSeller = !!sellerRes.data;
  const isBusiness = !!businessRes.data;

  return {
    userId: user.id,
    isAdmin: user.app_metadata?.role === 'admin',
    isBuyer: !!buyerRes.data,
    isSeller,
    isBusiness,
    sellerVerificationStatus: isSeller
      ? ((sellerRes.data?.verification_status ?? null) as SellerVerificationStatus | null)
      : null,
    businessVerificationStatus: isBusiness
      ? ((businessRes.data?.verification_status ?? null) as BusinessVerificationStatus | null)
      : null,
  };
}
