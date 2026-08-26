// lib/auth.ts
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

export type UserRole = 'buyer' | 'seller' | 'bsm' | 'admin';

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  profile?: BuyerProfile | SellerProfile | BusinessProfile;
  isAdmin?: boolean;
  isBuyer?: boolean;
  isSeller?: boolean;
  isBusiness?: boolean;
};

export type BuyerProfile = {
  id: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  gender?: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
  date_of_birth?: string;
  country?: string;
  phone?: string;
  communication_preferences: any;
  interests: string[];
  created_at: string;
  updated_at: string;
};

export type SellerVerificationStatus =
  | 'pending'
  | 'under_review'
  | 'verified'
  | 'rejected'
  | 'suspended';

export type SellerProfile = {
  id: string;
  storefront_name: string;
  store_slug: string;
  bio?: string;
  logo_url?: string;
  banner_url?: string;
  business_type: 'individual' | 'business' | 'creator';
  verification_status: SellerVerificationStatus;
  return_policy?: string;
  shipping_policy?: string;
  created_at: string;
  updated_at: string;
};

export type BusinessProfile = {
  id: string;
  display_name: string;
  legal_name?: string;
  business_kind:
    | 'brand'
    | 'supplier'
    | 'manufacturer'
    | 'distributor'
    | 'wholesaler'
    | 'retailer'
    | 'other';
  description?: string;
  website?: string;
  country?: string;
  logo_url?: string;
  banner_url?: string;
  verification_status: SellerVerificationStatus;
  created_at: string;
  updated_at: string;
};

export async function signUp(email: string, password: string, _role: UserRole = 'buyer') {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Capability creation and mutation are server-only through trusted /api routes.
// Browser code may read the current user's profiles through RLS. Capability
// absence is expected in the additive account model, so maybeSingle() is used to
// avoid turning a legitimate zero-row result into a noisy PostgREST HTTP 406.
export async function getBuyerProfile(userId: string): Promise<BuyerProfile | null> {
  const { data, error } = await supabase.from('profiles_buyer').select('*').eq('id', userId).maybeSingle();
  if (error) return null;
  return data;
}

export async function getSellerProfile(userId: string): Promise<SellerProfile | null> {
  const { data, error } = await supabase.from('profiles_seller').select('*').eq('id', userId).maybeSingle();
  if (error) return null;
  return data;
}

export async function getBusinessProfile(userId: string): Promise<BusinessProfile | null> {
  const { data, error } = await supabase.from('profiles_business').select('*').eq('id', userId).maybeSingle();
  if (error) return null;
  return data;
}

// Compatibility helper for the existing Buyer dashboard. The userId argument is
// intentionally not trusted or sent to the backend; the server derives identity
// from the authenticated session and updates only that Buyer projection.
export async function updateBuyerProfile(_userId: string, updates: Partial<BuyerProfile>) {
  const response = await fetch('/api/buyer/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Unable to update buyer profile');
  return result.profile as BuyerProfile;
}

export async function getUserRole(userId: string): Promise<UserRole> {
  const [sellerResult, businessResult, buyerResult] = await Promise.all([
    supabase.from('profiles_seller').select('id').eq('id', userId).maybeSingle(),
    supabase.from('profiles_business').select('id').eq('id', userId).maybeSingle(),
    supabase.from('profiles_buyer').select('id').eq('id', userId).maybeSingle(),
  ]);
  if (sellerResult.data) return 'seller';
  if (businessResult.data) return 'bsm';
  if (buyerResult.data) return 'buyer';
  return 'buyer';
}
