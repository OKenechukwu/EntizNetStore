// `/dashboard/profile` is the stable profile entry point. The canonical Buyer
// profile editor already lives in the Buyer dashboard and enforces the
// server-derived Buyer capability before rendering. Re-export it here instead
// of routing through the generic post-login destination, which intentionally
// sends Buyer-only accounts to `/store` and made the profile URL unusable.
//
// Seller/Business accounts are also provisioned with Buyer capability in the
// canonical multi-capability model, so they retain access to this shared
// account profile without collapsing their Seller/Business capabilities.
export { default } from "../buyer/page";
