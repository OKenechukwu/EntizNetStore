// Canonical EntizNetStore capability model + post-login routing.
//
// Capabilities are additive and server-derived from canonical profile rows:
//   profiles_buyer    -> buyer
//   profiles_seller   -> seller (+ verification lifecycle)
//   profiles_business -> business/BSM (+ verification lifecycle)
//   trusted app_metadata.role === 'admin' -> admin
//
// Never derive authorization from user_metadata.role, localStorage, URL params,
// or caller-supplied IDs. This mirrors EntizNet's multi-capability direction
// without tightly coupling the two products' databases.

export type SellerVerificationStatus =
  | 'pending'
  | 'under_review'
  | 'verified'
  | 'rejected'
  | 'suspended';

export type BusinessVerificationStatus = SellerVerificationStatus;

export type Capabilities = {
  userId: string;
  isAdmin: boolean;
  isBuyer: boolean;
  isSeller: boolean;
  isBusiness: boolean;
  sellerVerificationStatus: SellerVerificationStatus | null;
  businessVerificationStatus: BusinessVerificationStatus | null;
};

/**
 * Stable post-login destination. Capability is never discarded by routing:
 * admin > seller > business/BSM > buyer. A future capability switcher can
 * expose every dashboard while this remains a deterministic default.
 */
export function destinationForCapabilities(caps: Capabilities | null): string {
  if (!caps) return '/store';
  if (caps.isAdmin) return '/admin';
  if (caps.isSeller) return '/dashboard/seller';
  if (caps.isBusiness) return '/dashboard/bsm';
  return '/store';
}
