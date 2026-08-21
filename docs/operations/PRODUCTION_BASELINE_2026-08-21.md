# EntizNetStore production baseline — 2026-08-21

This document records the verified live Supabase state immediately before the M0 production-foundation hardening work. Repository code and the live project are the source of truth; historical Replit/Neon material is not.

## Live project

- Supabase project ref: `kllwwurklumhawfsilpd`
- Region: `us-east-1`
- Status at capture: `ACTIVE_HEALTHY`
- PostgreSQL: 17.6 (Supabase build reported 17.6.1.042)
- Database size at capture: 13 MB
- Extensions: `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp`
- Auth users: 0
- Storage objects: 0
- Application transactional rows: 0 products, 0 orders, 0 messages, 0 payment sessions
- Seed/reference rows: 6 brands + 16 categories

The complete current application data set is preserved in `supabase/seed.sql`.

## Canonical live migration history

The migration records reported by the live project, in order, are:

1. `20260809114139_canonical_marketplace_baseline`
2. `20260815000000_auth_foreign_keys`
3. `20260815120000_core_marketplace_rls`
4. `20260820024304_messaging_rls`
5. `20260820024336_messaging_security_hardening`
6. `20260820160109_atomic_seller_product_save`
7. `20260820160450_preserve_ordered_product_variants`
8. `20260820160526_complete_variant_preservation_repair`
9. `20260820162633_checkout_payment_foundation`
10. `20260820162810_require_checkout_shipping_address`
11. `20260820163027_transaction_read_policies`
12. `20260820163718_seller_order_fulfillment`
13. `20260820175213_multi_variant_seller_product_save`

Before M0 reconciliation, repository filenames for items 4–13 used later timestamps even though their SQL had already been applied under the live versions above. M0 renames those repository files to the exact live migration versions without changing applied SQL content. Applied migrations must never be rewritten.

## RLS baseline

All 27 exposed `public` tables had RLS enabled at capture time.

The security advisor reported RLS enabled with no policy on these tables:

- `addresses`
- `admin_audit_logs`
- `content_pages`
- `conversation_keys`
- `featured_products`
- `kyc_documents`
- `kyc_verification_requests`
- `message_attachments`
- `notifications`
- `payment_webhook_events`
- `reviews`

No-policy + RLS-enabled means deny-by-default to `anon`/`authenticated`; M0 must not create broad allow policies merely to silence the advisor. Each table must receive a policy only when a verified product flow requires one.

## SECURITY DEFINER baseline

Seven `public` functions were `SECURITY DEFINER` at capture time:

- `attach_checkout_payment_intent(uuid,text)` — authenticated + service role execute
- `cancel_checkout_session(uuid)` — authenticated + service role execute
- `create_checkout_session(jsonb,jsonb,uuid)` — authenticated + service role execute
- `finalize_checkout_payment(text,text,uuid,text,boolean)` — service role only
- `mark_conversation_read(uuid)` — authenticated + service role execute
- `touch_conversation_after_message()` — service role only / trigger helper
- `transition_seller_order(uuid,text,text,text)` — authenticated + service role execute

`mark_conversation_read` and `touch_conversation_after_message` already use an empty `search_path`. The checkout/order functions use ownership checks and require authenticated execution for legitimate flows, but several used `search_path=public`; M0 hardens their search path and explicit grants without breaking required RPC access.

## Performance baseline

The performance advisor identified missing supporting indexes for foreign keys on:

- `addresses.user_id`
- `categories.parent_id`
- `featured_products.product_id`
- `inventory_reservations.payment_session_id`
- `inventory_reservations.product_id`
- `messages.order_id`
- `order_items.variant_id`
- `payment_webhook_events.payment_session_id`
- `product_categories.category_id`
- `product_media.product_id`
- `product_media.variant_id`
- `product_variants.product_id`
- `products.brand_id`
- `reviews.buyer_id`

The advisor also reported RLS init-plan inefficiencies where `auth.uid()` is evaluated per row and multiple permissive SELECT policies on public-catalog tables. These are M0 hardening targets. "Unused index" findings are not actionable at this baseline because the database contains no transactional workload.

## Backup status

Supabase documentation currently recommends that Free-plan projects export their own logical backups with `supabase db dump`; guaranteed scheduled daily backups are a paid-plan feature. The connected development tool cannot emit a downloadable `pg_dump` artifact or access the database password, so the pre-change recoverable baseline stored in Git consists of:

- exact canonical migration history above;
- the complete current application data set in `supabase/seed.sql`;
- schema contained in ordered migrations;
- the security/function/policy state recorded here;
- zero auth users and zero storage objects at capture time.

Before public launch or before any irreplaceable customer/payment data is accepted, an encrypted off-platform logical dump and a paid managed backup/PITR decision are mandatory launch gates. See `docs/operations/BACKUP_RECOVERY.md`.

## M0 rule

Any live database change after this capture must be represented by a new forward migration and verified against the live project. No applied migration is to be edited in place.
