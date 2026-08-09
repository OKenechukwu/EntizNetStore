# EntizNetStore — Source Database Backups (Module 1C-1A)

Created: 2026-08-09 11:41:39 UTC (logical backups, pg_dump 16.10, custom format `-Fc`)
Neither source database was modified.

| File | Source | Size | Public tables | Verification |
|---|---|---|---|---|
| `replit_database_20260809T114139Z.dump` | Replit-managed database (`DATABASE_URL`, current canonical) | 67,641 B | 23 | PASS — full restore into scratch PostgreSQL 16 succeeded with zero errors |
| `legacy_neon_20260809T114139Z.dump` | Legacy Neon-hosted database (`NEON_DATABASE_URL`) | 68,976 B | 23 | PASS — full restore into scratch PostgreSQL 16 succeeded with zero errors |

## Restored row counts (identical in both backups, matching the live audit)

| Table | Rows |
|---|---|
| products | 14 |
| profiles_seller | 4 |
| profiles_buyer | 0 |
| orders | 4 |
| order_items | 4 |
| reviews | 20 |
| product_variants | 9 |
| categories | 16 |
| brands | 6 |
| escrow_transactions | 4 |
| product_categories | 15 |
| product_media | 0 |
| kyc_verification_requests | 1 |

All other public tables: 0 rows (verified individually in both restored backups; both backups hold identical data). The dumps also include the `supabase_migrations.schema_migrations` table (empty).

No connection strings or secrets are stored in these files or this manifest.
