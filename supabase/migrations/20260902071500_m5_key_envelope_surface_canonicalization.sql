-- EntizNetStore M5 — canonicalize wrapped conversation-key persistence.
--
-- M5 initially introduces a dedicated public message_key_envelopes table. Before
-- this branch can reach production, fold that physical storage into the existing
-- deny-by-default conversation_keys relation and leave message_key_envelopes as
-- a service-role-only compatibility view. This keeps the canonical public table
-- count stable, removes the legacy raw-key meaning from conversation_keys, and
-- avoids expanding the browser-exposed PostgREST table surface.
--
-- Both relations must be empty at this transition. Production was verified empty
-- before M5 development; failing closed here prevents an old deployment race from
-- silently converting an unwrapped legacy key into a wrapped-key record.

begin;

do $$
begin
  if exists (select 1 from public.conversation_keys limit 1) then
    raise exception 'legacy_conversation_keys_must_be_empty_before_m5_envelope_transition'
      using errcode = '55000';
  end if;

  if exists (select 1 from public.message_key_envelopes limit 1) then
    raise exception 'message_key_envelopes_must_be_empty_before_m5_surface_transition'
      using errcode = '55000';
  end if;
end
$$;

-- The M5 table has not accepted application traffic yet, so replace it with a
-- view after upgrading the existing physical relation.
drop table public.message_key_envelopes;

alter table public.conversation_keys
  rename column encrypted_key to wrapped_key;

-- participant1_id / participant2_id belonged to the retired pairwise-key model.
-- They remain nullable compatibility columns so an emergency rollback can still
-- inspect the old shape, but new envelope persistence never treats them as an
-- authorization source.
alter table public.conversation_keys
  alter column participant1_id drop not null,
  alter column participant2_id drop not null,
  alter column id set default gen_random_uuid()::text,
  add column conversation_id uuid not null unique
    references public.conversations(id) on delete cascade,
  add column wrap_iv text not null,
  add column kek_id text not null,
  add column key_wrap_version text not null default 'kek-aes-256-gcm-v1',
  add column updated_at timestamptz not null default now(),
  add constraint conversation_keys_wrapped_key_length_check
    check (char_length(wrapped_key) between 40 and 1024),
  add constraint conversation_keys_wrap_iv_length_check
    check (char_length(wrap_iv) between 16 and 128),
  add constraint conversation_keys_kek_id_length_check
    check (char_length(kek_id) between 3 and 128),
  add constraint conversation_keys_wrap_version_check
    check (key_wrap_version = 'kek-aes-256-gcm-v1');

alter table public.conversation_keys enable row level security;
revoke all on public.conversation_keys from public, anon, authenticated;
grant all on public.conversation_keys to service_role;

-- A simple security-invoker view preserves the application-level semantic name
-- while the physical table stays inside the already-audited 49-table baseline.
-- Browser roles receive no privileges on either relation.
create view public.message_key_envelopes
with (security_invoker = true)
as
select
  conversation_id,
  wrapped_key,
  wrap_iv,
  kek_id,
  key_wrap_version,
  created_at,
  updated_at
from public.conversation_keys;

revoke all on public.message_key_envelopes from public, anon, authenticated;
grant select, insert, update, delete on public.message_key_envelopes to service_role;

commit;
