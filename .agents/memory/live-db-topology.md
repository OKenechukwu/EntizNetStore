---
name: Live DB topology
description: Where EntizNetStore's live data actually is (Neon, not Supabase) and RLS state, verified Aug 2026
---
Verified 2026-08-07 during inspection-only audit:
- The connected Supabase project (NEXT_PUBLIC_SUPABASE_URL) is **empty**: PostgREST schema cache exposes no tables (PGRST205 for products, even with service role), and `/storage/v1/bucket` returns zero buckets. All app supabase-js queries against products therefore fail live.
- The real marketplace schema lives in the **Neon Postgres** at `NEON_DATABASE_URL` (db `neondb`, 23 public tables). It has no `auth` or `storage` schema, no anon/authenticated/service_role roles, and `supabase_migrations.schema_migrations` is empty (schema was applied ad hoc, not via migration tooling).
- Live `products` ownership field is **seller_id only** (nullable, NO foreign key). No `owner`/`provider_id` columns exist despite app code and old migrations referencing them. 14 products; 3 have NULL seller_id.
- RLS on Neon is effectively off: products and most tables have RLS disabled; a few tables have RLS enabled with 0 policies; only `notifications` has 4 policies (public role, JWT-claim based). The connecting role `neondb_owner` has BYPASSRLS anyway.
**Why:** any "fix RLS/ownership" work must target the Neon DB reality, not the Supabase migrations in `supabase/migrations/`, and RLS cannot protect anything while the app's data path (Supabase REST) points at an empty project.
**How to apply:** before schema/security changes, re-verify which database the app actually reads at runtime and reconcile the Supabase-vs-Neon split first.
- Decision (2026-08-07): Neon is the single source of truth for app data; Supabase is auth-only. There is no persisted storefront slug — public storefront URLs resolve by seller UUID or a slug derived from the storefront name.
