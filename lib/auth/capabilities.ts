// lib/auth/capabilities.ts
//
// Server-side canonical capability resolver. Identity comes from the
// cookie-validated auth user (supabase.auth.getUser()), never from
// caller-supplied IDs. Profile reads use the user's own RLS-scoped client
// (owner policies on profiles_buyer / profiles_seller), not the service role.
import { createServerSupabase } from "@/lib/supabase/server";
import type {
  Capabilities,
  SellerVerificationStatus,
} from "./capabilityRouting";

export async function resolveCapabilities(): Promise<Capabilities | null> {
  const supabase = createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const [buyerRes, sellerRes] = await Promise.all([
    supabase
      .from("profiles_buyer")
      .select("id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles_seller")
      .select("id, verification_status")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const isSeller = !!sellerRes.data;

  return {
    userId: user.id,
    // Admin comes ONLY from trusted app_metadata (set via Supabase Admin
    // API / service role) — never from client-mutable user_metadata.
    isAdmin: user.app_metadata?.role === "admin",
    isBuyer: !!buyerRes.data,
    isSeller,
    sellerVerificationStatus: isSeller
      ? ((sellerRes.data?.verification_status ??
          null) as SellerVerificationStatus | null)
      : null,
  };
}
