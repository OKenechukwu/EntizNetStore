# SECURITY DEFINER Surface Verification — 2026-08-25

## Purpose

EntizNetStore uses a limited set of PostgreSQL `SECURITY DEFINER` functions where a transaction must cross normal RLS boundaries while still enforcing explicit application ownership or trusted-worker rules. Because these functions execute with elevated database privileges, browser-callable functions are treated as a reviewed API surface rather than accepted implicitly from Supabase advisor warnings.

## Live audit result

The 2026-08-25 production audit enumerated every `public` `SECURITY DEFINER` function executable by `authenticated` and every function executable by `anon`.

- Anonymous public `SECURITY DEFINER` RPC surface: **0 functions**.
- Authenticated public `SECURITY DEFINER` surface before this hardening: **22 functions**.
- `public.attach_checkout_payment_intent(uuid,text)` was the only reviewed function determined to be obsolete client surface. It is a Stripe-specific compatibility wrapper; current application code calls the provider-neutral `public.attach_checkout_payment_reference(uuid,text,text)` RPC instead.
- This hardening revokes the legacy wrapper from `PUBLIC`, `anon` and `authenticated`, retaining `service_role` execution only.
- The remaining **21 authenticated functions** are explicitly allow-listed by `scripts/test-security-definer-surface.sql`. Any new or renamed browser-callable privileged RPC fails fresh-database CI until the allowlist is consciously reviewed.

## Why authenticated SECURITY DEFINER warnings remain

Supabase's security advisor correctly warns whenever signed-in users can execute a `SECURITY DEFINER` function. A warning is not automatically a vulnerability: several EntizNetStore RPCs deliberately provide atomic Buyer/Seller operations across RLS-protected tables and self-scope to the authenticated actor with `auth.uid()` and ownership/capability checks.

Examples include cart mutation, address ownership, checkout session ownership, Seller product ownership, order transitions, disputes, reports and notification-read operations. These warnings remain visible and are not silenced by weakening the advisor or blanket-revoking application RPCs.

The regression's purpose is to make the surface explicit and non-expanding, not to claim every `SECURITY DEFINER` call is harmless merely because it is existing code.

## `app_private` catalogue RLS helper

`app_private.marketplace_capability_is_active(uuid,text)` is a deliberate special case created in `20260823037000_m3_advisor_hardening.sql`.

Public catalogue RLS policies for products, variants, media and categories call this helper while evaluating anonymous/authenticated reads. Therefore the `anon` and `authenticated` PostgreSQL roles require schema `USAGE` and function `EXECUTE` for policy evaluation.

This does **not** make it a public REST RPC because `app_private` is not an exposed Data API schema. The equivalent `public.marketplace_capability_is_active(uuid,text)` function has direct `anon`/`authenticated` execution revoked. The regression protects both sides of this contract so future cleanup does not accidentally break public storefront visibility or re-expose the generic probe through the public API schema.

## Regression contract

`scripts/test-security-definer-surface.sql` verifies on every fresh Supabase replay that:

1. no `public` `SECURITY DEFINER` function is executable by `anon`;
2. the authenticated `public` privileged RPC set exactly matches the reviewed 21-function allowlist;
3. the retired Stripe wrapper is client-inaccessible and remains service-role-only;
4. the canonical provider-neutral payment-reference RPC remains authenticated/service-role callable, anonymous-denied, and retains `auth.uid()` ownership scoping;
5. the non-exposed `app_private` catalogue helper remains available to RLS evaluation while the equivalent public capability probe stays browser-inaccessible.

## Production release procedure

1. Replay all repository migrations on fresh Supabase and run the complete database regression matrix.
2. Run the dedicated real HTTP authorization suite and application build/type/lint gates.
3. Verify an exact-head Vercel preview when available.
4. Apply the forward privilege migration to production before merging the application/docs branch. The old application does not call the retired wrapper, so this ordering is backward-compatible.
5. Verify production ACLs and rerun Supabase security advisors. The `attach_checkout_payment_intent` authenticated advisor warning should disappear; reviewed self-scoped warnings remain expected.
6. Merge with exact-head SHA protection and verify canonical production health/runtime errors.

## Non-goals

This verification does not replace application-level authorization tests, RLS tests, provider reconciliation, secret rotation, malware scanning or broader database privilege review. It specifically prevents unreviewed expansion of the browser-callable `SECURITY DEFINER` RPC surface.
