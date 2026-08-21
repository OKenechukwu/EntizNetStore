// lib/auth/capabilityRouting.ts
//
// Canonical capability model + post-login routing (pure module — safe to
// import from both server and client code; no I/O here).
//
// Capabilities are derived ONLY from:
//   - profiles_buyer row presence  → buyer capability
//   - profiles_seller row presence → seller capability (+ verification_status)
//   - trusted app_metadata.role === 'admin' → admin
//
// Never derive capability from user_metadata.role, localStorage, URL
// parameters, or caller-supplied IDs.

export type SellerVerificationStatus = "pending" | "verified" | "rejected";

export type Capabilities = {
  userId: string;
  isAdmin: boolean;
  isBuyer: boolean;
  isSeller: boolean;
  /** Live value from profiles_seller.verification_status; null when not a seller. */
  sellerVerificationStatus: SellerVerificationStatus | null;
};

/**
 * Canonical post-login destination:
 * - admin                → /admin
 * - seller (incl. buyer+seller) → /dashboard/seller (buyer capability is
 *   preserved — sellers can still browse/buy; no role switcher)
 * - buyer only           → /store
 * - no capability yet    → /store (no dedicated onboarding chooser route
 *   exists; pending-onboarding completion is handled separately as a UX hint)
 */
export function destinationForCapabilities(
  caps: Capabilities | null,
): string {
  if (!caps) return "/store";
  if (caps.isAdmin) return "/admin";
  if (caps.isSeller) return "/dashboard/seller";
  if (caps.isBuyer) return "/store";
  return "/store";
}
