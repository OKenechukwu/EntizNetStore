# M3 Release Verification — Marketplace Operations, Admin & EntizNet Integration

**Status:** PRODUCTION DATABASE VERIFIED; FINAL WEB/INTEGRATION PROMOTION PENDING  
**Verified:** 2026-08-24  
**Store release head before this evidence commit:** `1ea6918176f09e689588ead0d8bd71d978b48267`

## Scope

This record captures the release evidence for the combined M3 milestone covering trusted marketplace operations, Admin control planes, and the EntizNet identity/capability handoff boundary.

It does not by itself approve public launch. Durable backups, production processor/payout integration, observability, deployment capacity, native mobile, accessibility and other canonical launch blockers remain independent gates.

## CI release evidence

EntizNetStore CI #333, run `32680825079`, passed on exact code head `1ea6918176f09e689588ead0d8bd71d978b48267`.

The successful release stack included:

- production-foundation verification;
- TypeScript type-check;
- production Next.js build;
- production dependency audit;
- clean Supabase/PostgreSQL 17 startup;
- replay of every repository migration and seed;
- canonical database verifier;
- M2 and M3 structural database invariants;
- M1 identity/KYC/storage and BSM regressions;
- M2 catalogue/moderation, inventory, approval and policy regressions;
- M3 cart/order, identity, linked-EntizNet authority, catalogue governance, Trust & Safety, content/notification, refund/dispute and financial-operation regressions;
- P0 commerce/authorization regressions;
- provider-neutral and terminal payment-state regressions;
- payout-ledger regression;
- concurrent payout escrow-claim regression.

CI #332 intentionally failed before this final run because an older verification assertion still expected the generic capability predicate to remain browser executable. Migration 14 had already made that public RPC unavailable by design. The canonical verifier was corrected to enforce the safer non-exposed helper contract, and the complete clean-database stack then passed in CI #333.

## Production Supabase rollout

Canonical production project: `kllwwurklumhawfsilpd`.

Fourteen forward M3 migrations are live. The Supabase management API recorded the following live migration versions:

1. `20260823152121` — `m3_persistent_cart_address_foundation`
2. `20260823152244` — `m3_quote_checkout_v2`
3. `20260823152354` — `m3_identity_operations_entiznet_foundation`
4. `20260823152435` — `m3_capability_enforcement`
5. `20260823152524` — `m3_admin_account_operations`
6. `20260823152612` — `m3_admin_order_operations`
7. `20260823152816` — `m3_refund_dispute_foundation`
8. `20260823152946` — `m3_refund_dispute_admin_operations`
9. `20260823153102` — `m3_financial_operations_admin_console`
10. `20260823153236` — `m3_linked_entiznet_capability_authority`
11. `20260823153344` — `m3_catalog_governance_admin_operations`
12. `20260823153603` — `m3_trust_safety_operations`
13. `20260823153652` — `m3_content_notification_operations`
14. `20260824014924` — `m3_advisor_hardening`

The live management-generated versions intentionally differ from repository filename timestamps for some M1–M3 migrations. Applied migrations are immutable; this known release-engineering timestamp drift must be handled by the deployment/migration procedure rather than rewriting historical SQL.

## Final production database postflight

After migration 14:

- public tables: **45**;
- RLS-enabled public tables: **45**;
- RLS-disabled public tables: **0**;
- all 11 M3 advisor FK indexes: present;
- all six critical capability/catalogue enforcement triggers: present;
- legacy arbitrary checkout: anon denied, authenticated denied, service role allowed;
- checkout v2: anon denied, authenticated allowed;
- `public.marketplace_capability_is_active(uuid,text)`: anon denied, authenticated denied, service role allowed;
- `app_private.marketplace_capability_is_active(uuid,text)`: present with pinned `search_path=pg_catalog, public` and available for RLS evaluation;
- anonymous product catalogue policy: confirmed to call the non-exposed `app_private` helper.

Production data remained preserved across the rollout:

- categories: 16;
- brands: 6;
- products: 0;
- Sellers: 0;
- Businesses: 0;
- carts: 0;
- orders: 0;
- payment sessions: 0;
- escrow transactions: 0;
- payout requests: 0;
- refund requests: 0;
- disputes: 0;
- marketplace reports: 0;
- reviews: 0;
- EntizNet identity links: 0;
- EntizNet handoff events: 0.

## Supabase advisor verification

### Performance

The pre-hardening advisor identified 11 unindexed M3 foreign keys. Migration 14 added covering indexes for every reported key. The post-hardening advisor contains **no `unindexed_foreign_keys` findings**.

The remaining performance entries are `unused_index` INFO notices. Production commerce is currently empty, so new and existing release-critical indexes have not accumulated planner usage. They are not removed merely because the empty production database has not exercised them yet.

Supabase remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

### Security

The anonymous SECURITY DEFINER warning for `public.marketplace_capability_is_active` is gone after migration 14 moved catalogue RLS evaluation to `app_private` and revoked browser execution from the public helper.

Nine RLS-enabled tables intentionally have no browser policies and therefore remain deny-by-default/service-role-only operational ledgers:

- `admin_audit_logs`;
- `conversation_keys`;
- `entiznet_handoff_events`;
- `featured_products`;
- `marketplace_capability_state_events`;
- `payment_webhook_events`;
- `payout_provider_events`;
- `prohibited_product_rules`;
- `refund_provider_events`.

Supabase remediation reference for this informational class: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

The remaining authenticated SECURITY DEFINER warnings correspond to reviewed, intentional owner/state-checked application RPC boundaries such as Buyer cart/address/refund/review operations, Seller catalogue operations, checkout v2, conversation/notification read state and order transitions. These functions are used instead of reopening direct browser DML, and their execute grants/search paths are part of the regression suite.

Supabase remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Paired EntizNet evidence

EntizNet repository `OKenechukwu/entiznet-bolt`, PR #29, exact head `5558bf1220d57cf38627023e777c977e3f15c431`, passed EntizNet CI #123 / run `32614073435` production build.

That counterpart implements the issuer/entry side of the Store contract: confirmed real-session identity, canonical active Store capabilities, short-lived Ed25519 assertion, issuer/audience, one-time `jti`, safe signed return path, POST handoff, and canonical `/entizstore` entry.

## Remaining promotion gates

Before M3 can be called fully production-web/integration verified:

1. merge the exact final Store branch after repository evidence commits pass CI;
2. verify the resulting Store Vercel deployment/alias and runtime health;
3. merge the paired EntizNet PR only after the Store receiver is landed;
4. verify the EntizNet deployment and production handoff configuration/keys;
5. perform a real deployed cross-product handoff/revocation/return-path verification when production secrets are provisioned.

The broader public-launch blockers in `LAUNCH_BLOCKERS.md` remain authoritative.