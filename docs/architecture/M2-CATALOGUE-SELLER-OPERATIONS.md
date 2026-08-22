# M2 — Catalogue & Seller Operations

Status: **ENGINEERING + LIVE DATABASE VERIFIED; MERGED TO MAIN; PRODUCTION PROMOTION BLOCKED BY VERCEL HOBBY BUILD-RATE LIMIT**

## Goal

M2 turns the catalogue foundation inherited from the original application into a production-safe Seller operating system. A verified Seller must be able to maintain a stable storefront, build rich products and variants, manage stock and media, submit a revision for independent Admin review, and expose only an approved revision to public shoppers.

The milestone deliberately reuses the canonical Supabase commerce schema. It does not introduce a second catalogue or rebuild working checkout/order infrastructure.

## Canonical storefront

`profiles_seller` is the Seller storefront projection.

M2 adds a persisted, unique, non-null `store_slug`:

- generated at Seller creation;
- clean human-readable slug when unique;
- deterministic UUID suffix only on collision;
- preserved when the Seller later renames the store;
- never accepted as a normal Seller-editable field.

Public storefront resolution is by persisted slug or Seller UUID. The application no longer scans all Seller names and derives an unstable slug at request time.

Seller storefront profile mutation is brokered by `/api/seller/storefront`; browser roles retain RLS-scoped read access but no direct profile DML. Store name, bio, shipping policy and return policy are therefore updated through trusted server authorization. Logo/banner upload continues through the M1 validated branding-storage boundary.

## Catalogue ownership

`products.seller_id` is canonical ownership and is `NOT NULL` with `ON DELETE RESTRICT` to `profiles_seller`.

A product cannot become orphaned by deleting a Seller projection. Product deletion itself is also denied when order history exists, preserving completed-commerce references.

Product children continue to belong through the parent product:

- `product_variants`;
- `product_media`;
- `product_categories`.

## Seller catalogue mutation boundary

Browser roles receive read access required for Seller dashboards and public catalogue reads but cannot directly `INSERT`, `UPDATE` or `DELETE` catalogue tables.

Seller writes use authenticated database RPCs with explicit ownership and state validation:

- `seller_save_product_v3`;
- `seller_submit_product_for_review`;
- `seller_set_product_publication`;
- `seller_delete_product`.

Legacy Seller save RPCs are no longer authenticated-executable, preventing an older path from bypassing M2 moderation.

The authenticated Seller RPCs are intentionally `SECURITY DEFINER` functions. They are an explicit reviewed Supabase advisor exception because direct browser table mutation is denied and the RPCs enforce `auth.uid()` ownership/state checks, hardened `search_path` configuration and cross-Seller regression coverage.

### Rich product save

`seller_save_product_v3` persists the existing canonical schema rather than creating duplicate fields. The contract includes:

- title, long and short descriptions;
- physical/digital product type;
- brand and up to ten categories;
- base price, compare-at price and cost;
- up to ten validated product images;
- up to one hundred variants;
- variant options, SKU and barcode;
- variant/base pricing and cost;
- tracked inventory quantity and inventory policy;
- shipping flags and weight;
- taxability;
- material;
- age restriction;
- tags and search keywords.

Every Seller create/edit is stored as a non-public draft. Editing a previously approved product invalidates the approval and forces a new review cycle.

## Product moderation state machine

Product moderation and publication are intentionally separate concepts.

Moderation states:

- `not_submitted`
- `pending`
- `approved`
- `rejected`

Publication uses the existing product status field. A public product must satisfy all of the following:

1. Seller verification status is `verified`;
2. product moderation status is `approved`;
3. product status is `active`.

A database check constraint additionally enforces that `active` implies `approved`, including for trusted/internal writes.

### Seller flow

1. Save/edit product → `draft` + `not_submitted`.
2. Submit complete revision → `draft` + `pending`.
3. Admin approves → `active` + `approved`.
4. Seller may unpublish an unchanged approved revision → inactive/non-public while approval remains valid.
5. Seller may republish that unchanged approved revision.
6. Any Seller edit → `draft` + `not_submitted`; previous approval no longer applies.
7. Rejected revision remains non-public and includes Admin notes for remediation.

### Admin flow

`admin_review_product` is service-role-only and the API also requires trusted Admin app metadata. The RPC re-checks the supplied Admin identity against `auth.users.raw_app_meta_data` before a decision.

Approval/rejection, the `product_moderation_events` row and the `admin_audit_logs` row occur in one database transaction.

The Admin moderation queue shows Seller verification context, product content, categories, media, variants and inventory before a decision.

## Moderation prerequisites

A product cannot enter `pending` or `approved` state unless the database can verify:

- the Seller is verified;
- the Seller has a real return policy;
- a shippable product has a real shipping policy;
- at least one active category is attached through the canonical submission flow;
- at least one product image exists;
- at least one active, positively priced variant exists.

This prevents the public product page from inventing missing logistics or return terms. M2 removes the historical hard-coded U.S. shipping origin/free-delivery claims from the buyer experience and displays the Seller's real policies instead.

## Public visibility and RLS

Public/anonymous product, variant, media and category-link policies require an approved active product owned by a verified Seller.

Authenticated users additionally see their own Seller drafts for dashboard/editor hydration. Cross-Seller private catalogue revisions remain hidden.

`product_moderation_events` is RLS-enabled. A Seller can read moderation history only for their own products; browser roles cannot mutate that history.

The live M2 Supabase baseline contains 32 public tables and all 32 have RLS enabled. Nine tables intentionally remain RLS-enabled with no browser policy so they deny by default.

## Product media

M2 retains the M1 `product-media` security model:

- Seller-scoped signed upload initialization;
- JPEG/PNG/WebP allow-list;
- maximum object size enforced by Storage;
- server re-download before product persistence;
- actual byte-size and magic-signature validation;
- URL/path ownership verification;
- obsolete object cleanup after a successful product edit/delete.

Product-media database mutation itself is RPC-only under M2.

## Inventory safety

Checkout already locks variants and creates pending `inventory_reservations` before payment.

M2 adds a Seller-edit guard: for a tracked variant with `inventory_policy='deny'`, a Seller cannot reduce `inventory_quantity` below the quantity already claimed by non-expired pending reservations.

This prevents a valid reserved checkout from later failing only because the Seller edited stock underneath it. Trusted payment finalization remains governed by the existing checkout/payment transaction state machine and is not blocked by the Seller-edit trigger.

## Seller operating UX

The canonical Seller product management surface now exposes:

- catalogue list and empty/error states;
- image, price and total active inventory;
- product moderation status;
- Admin rejection notes;
- publication status;
- Submit for Review;
- Unpublish;
- Republish;
- rich create/edit form;
- product detail with variant/SKU/inventory table;
- stable public-store link;
- storefront name/bio/shipping/return settings;
- validated logo/banner management.

The public product page links to the canonical persisted Seller storefront rather than a derived store-name slug.

## Forward migrations

M2 is forward-only. Applied migrations are never rewritten after live rollout.

The eight M2 forward migrations applied to the live EntizNetStore project are:

1. `m2_catalog_moderation_foundation`
2. `m2_clean_store_slugs`
3. `m2_profile_read_privilege_contract`
4. `m2_inventory_reservation_guard`
5. `m2_active_product_approval_invariant`
6. `m2_product_policy_completeness_guard`
7. `m2_product_policy_insert_guard`
8. `m2_moderation_fk_indexes`

The live Supabase management history records these migrations with management-generated timestamps. Repository migrations remain the canonical reproducible SQL source; applied live history is not rewritten to cosmetically force timestamp equality.

## Regression and reproduction gates

Fresh Supabase CI replays every repository migration and seed, then runs M2-specific verification in addition to all M1 and existing commerce/payment/payout suites.

M2 gates cover:

- structural moderation/storefront/inventory triggers and constraints;
- stable unique storefront slugs;
- moderation foreign-key covering indexes;
- no authenticated execution of legacy save RPCs;
- RPC-only Seller catalogue DML;
- cross-Seller mutation denial;
- draft/pending public invisibility;
- Admin-only moderation;
- atomic Admin moderation/audit history;
- approved public visibility of product children;
- approval invalidation after Seller edits;
- Seller moderation-history isolation;
- inventory reduction versus active checkout reservations;
- active-product approval invariant;
- Seller return/shipping policy prerequisites.

CI continues to run the production foundation scan, TypeScript, production build, dependency audit, M1 identity/KYC/storage suites, commerce authorization, payment state-machine suites, payout ledger and concurrent payout tests.

## Verified release evidence

- CI #185 passed the full release stack: production foundation, TypeScript, production build, dependency audit, fresh database replay, M1 identity/KYC/BSM, all M2 catalogue/moderation/inventory/policy gates, P0 commerce authorization, provider-neutral payment/terminal-state, payout ledger and concurrent escrow-claim regression.
- The first seven M2 forward migrations were then applied to live Supabase project `kllwwurklumhawfsilpd`.
- Live verification confirmed 32 public tables / 32 RLS-enabled tables, nine intentional deny-by-default tables, required storefront/moderation/inventory triggers, the active→approved constraint, expected RPC grants/search paths, browser catalogue DML denial, and zero existing marketplace/order rows altered.
- Live performance advisors identified two new moderation foreign keys without covering indexes. Those were fixed by the eighth forward migration, `m2_moderation_fk_indexes`, and the structural verifier was strengthened so either index disappearing fails CI.
- CI #187 passed the entire release stack including the new FK-index assertions.
- The eighth migration was applied live successfully. A repeat performance-advisor check no longer reports unindexed foreign keys; only expected unused-index INFO remains on the currently empty marketplace dataset.
- Security-advisor review adds four M2 Seller RPC warnings because authenticated users intentionally execute the `SECURITY DEFINER` catalogue boundary. These are reviewed exceptions, not unreviewed findings: ownership/state enforcement is inside the RPCs, direct table DML is denied, search paths are hardened, and cross-Seller attacks are regression-tested.
- Final evidence-head CI #189 passed the complete release stack again, including production build and every database/commerce/payment/payout/concurrency regression.
- Final release-head commit `b5e51be858b81267710d93ee945cf18f5fc1c605` has a READY Vercel preview that serves HTTP 200 with expected production-style security headers.
- PR #8 merged that exact tested head into `main` at `de1558d292d2e92fd256796b61e9f9bb47ac2160`.
- Post-merge GitHub status inspection shows Vercel rejected `de1558d...` with `upgradeToPro=build-rate-limit`. A docs-only `main` retrigger was rejected for the same reason, confirming a Vercel Hobby build-capacity limit rather than an M2 application failure.

## M2 exit gate

Engineering/database/main-merge portions of the M2 exit gate are verified:

- final application/database branch CI is green;
- all eight forward M2 migrations are applied to the correct live EntizNetStore Supabase project;
- live RLS/table/RPC/trigger/constraint/index invariants match the fresh-database baseline;
- Supabase security/performance advisors contain no new unreviewed launch-severity M2 findings;
- the exact tested release head is merged into `main`.

The remaining release condition is production alias promotion and runtime verification. It is currently blocked by Vercel Hobby build-rate limiting, not by code or database failure. The preferred recovery is to promote the already-validated READY preview deployment for `b5e51be...` to production without rebuilding, then verify HTTP 200 and production runtime errors.

Functional exit condition: **a verified Seller can operate a stable storefront, create and manage a complete product/variant/inventory listing, submit it for independent Admin review, and expose only the approved revision publicly without any Replit catalogue infrastructure.**

## Deliberately separate launch gates

M2 does not waive the canonical P0/P1 launch blockers. External payment/payout provider onboarding, durable managed/off-platform backup, production observability, final malware/content-moderation provider policy, EntizNet cross-product identity handoff, and native mobile delivery remain separate roadmap gates.
