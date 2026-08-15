// lib/auth.ts
import { supabase } from "./supabase";
import type { User, Session } from "@supabase/supabase-js";

export type UserRole = "buyer" | "seller" | "admin";

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  profile?: BuyerProfile | SellerProfile;
};

export type BuyerProfile = {
  id: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  gender?: "male" | "female" | "non-binary" | "prefer-not-to-say";
  date_of_birth?: string;
  country?: string; // stored as ISO alpha-2 (e.g., "DE", "PH")
  phone?: string;
  communication_preferences: any;
  interests: string[];
  created_at: string;
  updated_at: string;
};

export type SellerProfile = {
  id: string;
  storefront_name: string;
  bio?: string;
  logo_url?: string;
  banner_url?: string;
  business_type: "individual" | "business" | "creator";
  tax_id?: string;
  verification_status: "pending" | "verified" | "rejected";
  verification_documents?: any;
  payout_method?: any;
  return_policy?: string;
  shipping_policy?: string;
  created_at: string;
  updated_at: string;
};

/** Normalize a country string to ISO alpha-2 uppercase (or undefined) */
function normalizeCountryInput(value?: string | null): string | undefined {
  if (!value) return undefined;
  const s = value.trim();
  if (!s) return undefined;
  // If 2+ chars, take first 2 and uppercase (DB constraint enforces ^[A-Z]{2}$ or NULL)
  return s.slice(0, 2).toUpperCase();
}

// ---------------------- Authentication ----------------------

export async function signUp(
  email: string,
  password: string,
  // NOTE: role is intentionally NOT written to user_metadata. Capability is
  // determined server-side (profile presence / trusted app_metadata), never
  // by client-supplied metadata.
  _role: UserRole = "buyer",
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

// ------------------------ Profiles -------------------------

// CREATE
// Profile creation happens ONLY via the trusted server onboarding endpoints
// (/api/onboarding/buyer and /api/onboarding/seller). Client-side profile
// creation against legacy tables was removed intentionally.

// READ

export async function getBuyerProfile(
  userId: string,
): Promise<BuyerProfile | null> {
  const { data, error } = await supabase
    .from("profiles_buyer")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) return null;
  return data;
}

export async function getSellerProfile(
  userId: string,
): Promise<SellerProfile | null> {
  const { data, error } = await supabase
    .from("profiles_seller")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) return null;
  return data;
}

// UPDATE

export async function updateBuyerProfile(
  userId: string,
  updates: Partial<BuyerProfile>,
) {
  const normalized = {
    ...updates,
    country: normalizeCountryInput(updates.country),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles_buyer")
    .update(normalized)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSellerProfile(
  userId: string,
  updates: Partial<SellerProfile>,
) {
  const payload = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles_seller")
    .update(payload)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// -------------------- KYC / Verification -------------------
// KYC document submission happens via the trusted server endpoints
// (/api/kyc/*). The legacy client-side submitKYCDocuments helper was
// removed (unreferenced, targeted a phantom table).

// ------------------------ Roles ----------------------------

export async function getUserRole(userId: string): Promise<UserRole> {
  // Seller wins if both exist
  const { data: seller } = await supabase
    .from("profiles_seller")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (seller) return "seller";

  const { data: buyer } = await supabase
    .from("profiles_buyer")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (buyer) return "buyer";

  return "buyer";
}
