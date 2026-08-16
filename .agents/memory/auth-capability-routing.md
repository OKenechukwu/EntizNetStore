---
name: Auth capability routing
description: Canonical capability/routing model, PKCE flow, and recovery-page redirect exemptions for EntizNetStore auth.
---

# Canonical capability & post-login routing

Rule: capability (buyer/seller/admin) is ONLY server-derived — profile-row
presence in `profiles_buyer`/`profiles_seller` (seller carries
`verification_status`: pending|verified|rejected) plus trusted
`app_metadata.role === 'admin'`. Browser code must resolve it through
`GET /api/auth/capabilities`; never from `user_metadata.role`, localStorage,
or URL params. `user_metadata` holds only non-security profile info
(phone/address).

**Why:** `user_metadata` is client-mutable (self-privilege-escalation risk);
Phase B1 removed all `user_metadata.role` routing and deleted the hook that
wrote role into metadata from a phantom `user_roles` table.

**How to apply:**
- Post-login defaults: admin → /admin; seller (incl. buyer+seller) →
  /seller/dashboard; buyer-only → /store; none → /store. A user may hold both
  capabilities — never collapse them (AuthProvider exposes isBuyer/isSeller).
- Browser Supabase client uses `flowType: "pkce"` — consistent with
  `exchangeCodeForSession()` in /auth/callback and recovery links. Do not
  revert to implicit.
- Any global SIGNED_IN redirect listener (SessionWatcher) must ignore the
  event on `/auth/reset-password` and `/auth/callback`, or password recovery
  breaks (recovery links sign the user in on the reset page).
- Canonical sign-in route is `/auth/sign-in`; `/auth/signin` is a redirect
  stub only.
- `/admin` has NO page yet — admin destination 404s until one exists.
