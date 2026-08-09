---
name: Live DB topology
description: Where EntizNetStore's live data actually is (Replit-managed Postgres lineage), Supabase role, and RLS state
---
Verified 2026-08-07/08 during inspection-only audits:
- **Provenance solved (2026-08-08):** `NEON_DATABASE_URL` is the LEGACY Replit-managed Neon-hosted built-in database (Replit provisioned it; no separate Neon account exists). Replit auto-migrated it to Helium infrastructure: `DATABASE_URL` (host `*.helium`, db `heliumdb`) is the CURRENT Replit-managed DB and contains an identical copy (same 23 tables, same 14 product slugs, sellers=4, orders=4, incl. `supabase_migrations` schema). Per Replit docs, the legacy connection string was saved to Secrets as `NEON_DATABASE_URL` for reference.
- **Risk:** Task #1's data layer (`lib/db.ts`) connects to the LEGACY Neon URL, not `DATABASE_URL`. The two copies will diverge with new writes; Helium is the one integrated with Replit checkpoints/publish. Any future DB work should consider repointing `lib/db.ts` to `DATABASE_URL`.
- The Supabase project (`NEXT_PUBLIC_SUPABASE_URL`) now (2026-08-09) has the canonical baseline SCHEMA applied (24 tables, RLS on, 0 policies) as the sole recorded migration — but still 0 data rows, 0 auth users, 0 buckets. Apply changes via `psql "$SUPABASE_DB_URL"` or `supabase db push --db-url` (the Replit Supabase connector proxy is misconfigured — project_url holds only the ref — and cannot run SQL).
- Live `products` ownership field is **seller_id only** (nullable, no FK). No `owner`/`provider_id` columns. 3 of 14 products have NULL seller_id.
- RLS effectively off: products has RLS disabled, 0 policies; a few tables RLS-on with 0 policies; only `notifications` has 4 JWT-claim policies. Connecting roles (`neondb_owner`, helium owner) bypass RLS. No anon/authenticated roles exist.
**Why:** security/ownership fixes must be server-side application checks (DB roles bypass RLS), and must target the Replit-managed Postgres — Supabase migrations in `supabase/migrations/` do not describe the live DB (`supabase_migrations.schema_migrations` is empty).
**How to apply:** before schema/security changes, confirm which URL `lib/db.ts` uses and whether Neon-vs-Helium divergence has started.
