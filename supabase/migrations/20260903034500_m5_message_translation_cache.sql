-- M5 dark-launch message translation cache.
-- Canonical originals remain encrypted in public.messages. This table stores only
-- encrypted derived translations and is deliberately service-role only.

create table public.message_translations (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  target_language text not null,
  provider text not null,
  provider_version text not null,
  original_integrity_digest text not null,
  source_language text,
  status text not null default 'pending',
  ciphertext text,
  encryption_iv text,
  encryption_version text,
  claim_token uuid,
  claimed_at timestamptz,
  lease_expires_at timestamptz not null,
  attempt_count integer not null default 1,
  translated_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint message_translations_status_check
    check (status in ('pending', 'ready', 'failed')),
  constraint message_translations_target_language_check
    check (char_length(target_language) between 2 and 35),
  constraint message_translations_source_language_check
    check (source_language is null or char_length(source_language) between 2 and 35),
  constraint message_translations_provider_check
    check (provider ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$'),
  constraint message_translations_provider_version_check
    check (provider_version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$'),
  constraint message_translations_original_integrity_check
    check (original_integrity_digest ~ '^[0-9a-f]{64}$'),
  constraint message_translations_attempt_count_check
    check (attempt_count >= 1),
  constraint message_translations_pending_shape_check
    check (
      status <> 'pending'
      or (claim_token is not null and claimed_at is not null)
    ),
  constraint message_translations_ready_shape_check
    check (
      status <> 'ready'
      or (
        ciphertext is not null
        and encryption_iv is not null
        and encryption_version is not null
        and source_language is not null
        and translated_at is not null
        and claim_token is null
      )
    ),
  constraint message_translations_failed_shape_check
    check (
      status <> 'failed'
      or (last_error_code is not null and claim_token is null)
    ),
  constraint message_translations_unique_cache_entry
    unique (
      message_id,
      target_language,
      provider,
      provider_version,
      original_integrity_digest
    )
);

create index idx_message_translations_message
  on public.message_translations(message_id);

create index idx_message_translations_recoverable_claim
  on public.message_translations(status, lease_expires_at)
  where status in ('pending', 'failed');

alter table public.message_translations enable row level security;

revoke all on table public.message_translations from public, anon, authenticated;
grant select, insert, update, delete on table public.message_translations to service_role;

comment on table public.message_translations is
  'Server-only encrypted cache of derived message translations. Canonical originals remain public.messages ciphertext.';
comment on column public.message_translations.id is
  'Stable provider idempotency identity reused across retries and stale-lease takeover for this cache entry.';
comment on column public.message_translations.original_integrity_digest is
  'Keyed HMAC digest bound to the canonical original message; not a raw plaintext hash.';
comment on column public.message_translations.lease_expires_at is
  'Fail-recoverable provider-call claim lease used with the stable row id to prevent duplicate translation billing.';