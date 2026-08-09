# Archived pre-baseline migrations (historical reference only)

These migration files (001–006 and `20250926060603_init_profiles_with_country.sql`)
are **historical**. They were verified as **never applied** to the current
EntizNetStore Supabase project (its migration history is empty and the project
contains no tables).

They **must not be executed** against the new canonical Supabase backend —
several of them use an obsolete schema (`provider_id` ownership, old orders
shape, legacy RLS policies) that conflicts with the canonical baseline:

    supabase/migrations/20260809114139_canonical_marketplace_baseline.sql

They are retained here byte-for-byte, solely for historical/reference purposes.
Do not move them back into `supabase/migrations/`.
