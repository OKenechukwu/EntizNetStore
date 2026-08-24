-- EntizNetStore combined M3 — marketplace capability enforcement and
-- EntizNet identity-link/handoff foundation.
--
-- Buyer, Seller and Business are additive capabilities. Suspension is therefore
-- capability-specific: suspending Seller operations must not implicitly remove
-- Buyer access from the same auth user.

begin;

-- ---------------------------------------------------------------------------
-- Local marketplace capability state
-- ---------------------------------------------------------------------------
create table public.marketplace_capability_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  capability text not null
    constraint marketplace_capability_states_capability_check
    check (capability in ('buyer', 'seller', 'business')),
  status text not null default 'active'
    constraint marketplace_capability_states_status_check
    check (status in ('active', 'suspended')),
  reason text,
  suspended_at timestamptz,
  suspended_by uuid references auth.users(id) on delete set null,
  restored_at timestamptz,
  restored_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, capability),
  constraint marketplace_capability_states_reason_length_check
    check (reason is null or char_length(reason) <= 2000),
  constraint marketplace_capability_states_suspension_shape_check
    check (
      (status = 'active')
      or (status = 'suspended' and suspended_at is not null and suspended_by is not null)
    )
);

create index idx_marketplace_capability_states_status
  on public.marketplace_capability_states(capability, status, updated_at desc);

create table public.marketplace_capability_state_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  capability text not null
    constraint marketplace_capability_state_events_capability_check
    check (capability in ('buyer', 'seller', 'business')),
  old_status text not null
    constraint marketplace_capability_state_events_old_status_check
    check (old_status in ('active', 'suspended')),
  new_status text not null
    constraint marketplace_capability_state_events_new_status_check
    check (new_status in ('active', 'suspended')),
  reason text,
  actor_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'admin'
    constraint marketplace_capability_state_events_actor_type_check
    check (actor_type in ('admin', 'system', 'integration')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint marketplace_capability_state_events_reason_length_check
    check (reason is null or char_length(reason) <= 2000)
);

create index idx_marketplace_capability_state_events_user_created
  on public.marketplace_capability_state_events(user_id, created_at desc);
create index idx_marketplace_capability_state_events_capability_created
  on public.marketplace_capability_state_events(capability, created_at desc);

alter table public.marketplace_capability_states enable row level security;
alter table public.marketplace_capability_state_events enable row level security;

create policy marketplace_capability_states_select_own
on public.marketplace_capability_states
for select to authenticated
using (user_id = (select auth.uid()));

-- Immutable operational history is intentionally server/admin only. Ordinary
-- users see their current state but cannot enumerate or mutate event history.

grant select on public.marketplace_capability_states to authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.marketplace_capability_states from anon, authenticated;
revoke all on public.marketplace_capability_state_events from anon, authenticated;
grant all on public.marketplace_capability_states, public.marketplace_capability_state_events
  to service_role;

-- Returns effective local capability state. Capability existence is determined
-- by the canonical profile table; a missing suspension row means active.
create or replace function public.marketplace_capability_is_active(
  p_user_id uuid,
  p_capability text
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_user_id is null or p_capability not in ('buyer', 'seller', 'business') then
    return false;
  end if;

  if p_capability = 'buyer'
     and not exists (select 1 from public.profiles_buyer where id = p_user_id) then
    return false;
  end if;
  if p_capability = 'seller'
     and not exists (select 1 from public.profiles_seller where id = p_user_id) then
    return false;
  end if;
  if p_capability = 'business'
     and not exists (select 1 from public.profiles_business where id = p_user_id) then
    return false;
  end if;

  return not exists (
    select 1
    from public.marketplace_capability_states s
    where s.user_id = p_user_id
      and s.capability = p_capability
      and s.status = 'suspended'
  );
end;
$$;

revoke all on function public.marketplace_capability_is_active(uuid,text) from public;
grant execute on function public.marketplace_capability_is_active(uuid,text)
  to anon, authenticated, service_role;

-- Trusted Admin suspension/restoration boundary. Admin identity is verified from
-- auth.users.raw_app_meta_data, never from client metadata or request payload.
create or replace function public.admin_set_marketplace_capability_state(
  p_admin_id uuid,
  p_target_user_id uuid,
  p_capability text,
  p_status text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_old_status text := 'active';
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if p_admin_id is null
     or not exists (
       select 1 from auth.users u
       where u.id = p_admin_id
         and u.raw_app_meta_data->>'role' = 'admin'
     ) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;

  if p_target_user_id is null
     or not exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception 'target_user_not_found' using errcode = '22023';
  end if;
  if p_capability not in ('buyer', 'seller', 'business') then
    raise exception 'invalid_marketplace_capability' using errcode = '22023';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'invalid_marketplace_capability_status' using errcode = '22023';
  end if;
  if char_length(coalesce(v_reason, '')) > 2000 then
    raise exception 'capability_state_reason_too_long' using errcode = '22023';
  end if;
  if p_status = 'suspended' and v_reason is null then
    raise exception 'suspension_reason_required' using errcode = '22023';
  end if;

  if p_capability = 'buyer'
     and not exists (select 1 from public.profiles_buyer where id = p_target_user_id) then
    raise exception 'buyer_capability_not_found' using errcode = '22023';
  end if;
  if p_capability = 'seller'
     and not exists (select 1 from public.profiles_seller where id = p_target_user_id) then
    raise exception 'seller_capability_not_found' using errcode = '22023';
  end if;
  if p_capability = 'business'
     and not exists (select 1 from public.profiles_business where id = p_target_user_id) then
    raise exception 'business_capability_not_found' using errcode = '22023';
  end if;

  select status into v_old_status
  from public.marketplace_capability_states
  where user_id = p_target_user_id and capability = p_capability
  for update;

  if not found then
    v_old_status := 'active';
  end if;

  if v_old_status = p_status then
    -- Idempotent same-state calls are accepted, but do not manufacture duplicate
    -- operational history/audit rows.
    return;
  end if;

  insert into public.marketplace_capability_states(
    user_id, capability, status, reason,
    suspended_at, suspended_by, restored_at, restored_by,
    created_at, updated_at
  ) values (
    p_target_user_id,
    p_capability,
    p_status,
    v_reason,
    case when p_status = 'suspended' then now() else null end,
    case when p_status = 'suspended' then p_admin_id else null end,
    case when p_status = 'active' then now() else null end,
    case when p_status = 'active' then p_admin_id else null end,
    now(), now()
  )
  on conflict (user_id, capability)
  do update set
    status = excluded.status,
    reason = excluded.reason,
    suspended_at = case when excluded.status = 'suspended' then now() else marketplace_capability_states.suspended_at end,
    suspended_by = case when excluded.status = 'suspended' then p_admin_id else marketplace_capability_states.suspended_by end,
    restored_at = case when excluded.status = 'active' then now() else null end,
    restored_by = case when excluded.status = 'active' then p_admin_id else null end,
    updated_at = now();

  insert into public.marketplace_capability_state_events(
    user_id, capability, old_status, new_status, reason,
    actor_id, actor_type, metadata
  ) values (
    p_target_user_id, p_capability, v_old_status, p_status, v_reason,
    p_admin_id, 'admin', '{}'::jsonb
  );

  insert into public.admin_audit_logs(
    admin_id, action, target_type, target_id, metadata, timestamp, created_at
  ) values (
    p_admin_id,
    case when p_status = 'suspended' then 'marketplace_capability_suspended' else 'marketplace_capability_restored' end,
    'marketplace_capability',
    p_target_user_id::text || ':' || p_capability,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'capability', p_capability,
      'old_status', v_old_status,
      'new_status', p_status,
      'reason', v_reason
    ),
    now(), now()
  );
end;
$$;

revoke all on function public.admin_set_marketplace_capability_state(uuid,uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.admin_set_marketplace_capability_state(uuid,uuid,text,text,text)
  to service_role;

-- ---------------------------------------------------------------------------
-- EntizNet identity mapping
-- ---------------------------------------------------------------------------
create table public.entiznet_identity_links (
  id uuid primary key default gen_random_uuid(),
  store_user_id uuid not null references auth.users(id) on delete cascade,
  entiznet_user_id uuid not null,
  status text not null default 'active'
    constraint entiznet_identity_links_status_check
    check (status in ('active', 'revoked')),
  capabilities_snapshot text[] not null default '{}'::text[],
  capabilities_version text,
  link_source text not null default 'entiznet_handoff'
    constraint entiznet_identity_links_source_check
    check (link_source in ('entiznet_handoff', 'standalone_link', 'admin_recovery')),
  linked_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entiznet_identity_links_store_unique unique(store_user_id),
  constraint entiznet_identity_links_entiznet_unique unique(entiznet_user_id),
  constraint entiznet_identity_links_revocation_shape_check
    check (
      (status = 'active' and revoked_at is null)
      or (status = 'revoked' and revoked_at is not null)
    ),
  constraint entiznet_identity_links_reason_length_check
    check (revoked_reason is null or char_length(revoked_reason) <= 2000)
);

create index idx_entiznet_identity_links_status
  on public.entiznet_identity_links(status, updated_at desc);

alter table public.entiznet_identity_links enable row level security;
create policy entiznet_identity_links_select_own
on public.entiznet_identity_links
for select to authenticated
using (store_user_id = (select auth.uid()));

grant select on public.entiznet_identity_links to authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.entiznet_identity_links from anon, authenticated;
grant all on public.entiznet_identity_links to service_role;

-- Capability snapshots are informational evidence from EntizNet. They are never
-- a replacement for local Store authorization and must contain only Store
-- capability slugs defined by the EntizNet integration contract.
create or replace function public.upsert_entiznet_identity_link(
  p_store_user_id uuid,
  p_entiznet_user_id uuid,
  p_capabilities_snapshot text[],
  p_capabilities_version text,
  p_link_source text,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_existing public.entiznet_identity_links%rowtype;
  v_link_id uuid;
  v_cap text;
begin
  if p_store_user_id is null
     or not exists (select 1 from auth.users where id = p_store_user_id) then
    raise exception 'store_user_not_found' using errcode = '22023';
  end if;
  if p_entiznet_user_id is null then
    raise exception 'entiznet_user_required' using errcode = '22023';
  end if;
  if coalesce(p_link_source, 'entiznet_handoff') not in ('entiznet_handoff', 'standalone_link', 'admin_recovery') then
    raise exception 'invalid_link_source' using errcode = '22023';
  end if;

  foreach v_cap in array coalesce(p_capabilities_snapshot, '{}'::text[]) loop
    if v_cap not in ('entiznetstore_buyer', 'entiznetstore_seller', 'entiznetstore_business') then
      raise exception 'unsupported_entiznetstore_capability: %', v_cap using errcode = '22023';
    end if;
  end loop;

  select * into v_existing
  from public.entiznet_identity_links
  where store_user_id = p_store_user_id or entiznet_user_id = p_entiznet_user_id
  order by case when store_user_id = p_store_user_id and entiznet_user_id = p_entiznet_user_id then 0 else 1 end
  limit 1
  for update;

  if found and (
    v_existing.store_user_id <> p_store_user_id
    or v_existing.entiznet_user_id <> p_entiznet_user_id
  ) then
    raise exception 'identity_link_conflict' using errcode = '23505';
  end if;

  if found then
    update public.entiznet_identity_links
    set status = 'active',
        capabilities_snapshot = coalesce(p_capabilities_snapshot, '{}'::text[]),
        capabilities_version = nullif(btrim(coalesce(p_capabilities_version, '')), ''),
        link_source = coalesce(p_link_source, 'entiznet_handoff'),
        last_synced_at = now(),
        revoked_at = null,
        revoked_reason = null,
        metadata = coalesce(p_metadata, '{}'::jsonb),
        updated_at = now()
    where id = v_existing.id
    returning id into v_link_id;
  else
    insert into public.entiznet_identity_links(
      store_user_id, entiznet_user_id, capabilities_snapshot,
      capabilities_version, link_source, metadata
    ) values (
      p_store_user_id,
      p_entiznet_user_id,
      coalesce(p_capabilities_snapshot, '{}'::text[]),
      nullif(btrim(coalesce(p_capabilities_version, '')), ''),
      coalesce(p_link_source, 'entiznet_handoff'),
      coalesce(p_metadata, '{}'::jsonb)
    ) returning id into v_link_id;
  end if;

  return v_link_id;
end;
$$;

revoke all on function public.upsert_entiznet_identity_link(uuid,uuid,text[],text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.upsert_entiznet_identity_link(uuid,uuid,text[],text,text,jsonb)
  to service_role;

create or replace function public.revoke_entiznet_identity_link(
  p_entiznet_user_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_entiznet_user_id is null then
    raise exception 'entiznet_user_required' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'revocation_reason_required' using errcode = '22023';
  end if;
  if char_length(btrim(p_reason)) > 2000 then
    raise exception 'revocation_reason_too_long' using errcode = '22023';
  end if;

  update public.entiznet_identity_links
  set status = 'revoked',
      revoked_at = now(),
      revoked_reason = btrim(p_reason),
      updated_at = now()
  where entiznet_user_id = p_entiznet_user_id
    and status = 'active';
end;
$$;

revoke all on function public.revoke_entiznet_identity_link(uuid,text)
  from public, anon, authenticated;
grant execute on function public.revoke_entiznet_identity_link(uuid,text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Signed handoff replay/audit ledger
-- ---------------------------------------------------------------------------
create table public.entiznet_handoff_events (
  id uuid primary key default gen_random_uuid(),
  jti_hash text not null unique,
  entiznet_user_id uuid not null,
  store_user_id uuid references auth.users(id) on delete set null,
  issuer text not null,
  audience text not null,
  return_path text not null default '/',
  capabilities_snapshot text[] not null default '{}'::text[],
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  status text not null default 'pending'
    constraint entiznet_handoff_events_status_check
    check (status in ('pending', 'consumed', 'rejected', 'revoked', 'expired')),
  failure_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entiznet_handoff_events_jti_hash_check
    check (char_length(jti_hash) between 32 and 128),
  constraint entiznet_handoff_events_expiry_check
    check (expires_at > issued_at),
  constraint entiznet_handoff_events_return_path_check
    check (return_path ~ '^/[^\\]*$' and return_path !~ '^//'),
  constraint entiznet_handoff_events_failure_code_length_check
    check (failure_code is null or char_length(failure_code) <= 120)
);

create index idx_entiznet_handoff_events_entiznet_created
  on public.entiznet_handoff_events(entiznet_user_id, created_at desc);
create index idx_entiznet_handoff_events_store_created
  on public.entiznet_handoff_events(store_user_id, created_at desc)
  where store_user_id is not null;
create index idx_entiznet_handoff_events_status_expiry
  on public.entiznet_handoff_events(status, expires_at);

alter table public.entiznet_handoff_events enable row level security;
-- No browser policies: handoff replay/audit data is trusted-server only.
revoke all on public.entiznet_handoff_events from anon, authenticated;
grant all on public.entiznet_handoff_events to service_role;

create or replace function public.register_entiznet_handoff(
  p_jti_hash text,
  p_entiznet_user_id uuid,
  p_issuer text,
  p_audience text,
  p_return_path text,
  p_capabilities_snapshot text[],
  p_issued_at timestamptz,
  p_expires_at timestamptz,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
  v_cap text;
  v_return text := coalesce(nullif(btrim(coalesce(p_return_path, '')), ''), '/');
begin
  if p_jti_hash is null or char_length(p_jti_hash) < 32 or char_length(p_jti_hash) > 128 then
    raise exception 'invalid_handoff_jti_hash' using errcode = '22023';
  end if;
  if p_entiznet_user_id is null then
    raise exception 'entiznet_user_required' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_issuer, '')), '') is null
     or nullif(btrim(coalesce(p_audience, '')), '') is null then
    raise exception 'handoff_issuer_and_audience_required' using errcode = '22023';
  end if;
  if p_issued_at is null or p_expires_at is null or p_expires_at <= p_issued_at
     or p_expires_at <= now() then
    raise exception 'handoff_expired_or_invalid' using errcode = '22023';
  end if;
  if v_return !~ '^/[^\\]*$' or v_return ~ '^//' then
    raise exception 'invalid_return_path' using errcode = '22023';
  end if;

  foreach v_cap in array coalesce(p_capabilities_snapshot, '{}'::text[]) loop
    if v_cap not in ('entiznetstore_buyer', 'entiznetstore_seller', 'entiznetstore_business') then
      raise exception 'unsupported_entiznetstore_capability: %', v_cap using errcode = '22023';
    end if;
  end loop;

  begin
    insert into public.entiznet_handoff_events(
      jti_hash, entiznet_user_id, issuer, audience, return_path,
      capabilities_snapshot, issued_at, expires_at, metadata
    ) values (
      p_jti_hash, p_entiznet_user_id, btrim(p_issuer), btrim(p_audience), v_return,
      coalesce(p_capabilities_snapshot, '{}'::text[]), p_issued_at, p_expires_at,
      coalesce(p_metadata, '{}'::jsonb)
    ) returning id into v_id;
  exception when unique_violation then
    raise exception 'handoff_replay_detected' using errcode = '23505';
  end;

  return v_id;
end;
$$;

create or replace function public.complete_entiznet_handoff(
  p_event_id uuid,
  p_store_user_id uuid,
  p_status text,
  p_failure_code text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_status not in ('consumed', 'rejected', 'revoked', 'expired') then
    raise exception 'invalid_handoff_completion_status' using errcode = '22023';
  end if;
  if p_store_user_id is not null
     and not exists (select 1 from auth.users where id = p_store_user_id) then
    raise exception 'store_user_not_found' using errcode = '22023';
  end if;
  if char_length(coalesce(p_failure_code, '')) > 120 then
    raise exception 'handoff_failure_code_too_long' using errcode = '22023';
  end if;

  update public.entiznet_handoff_events
  set store_user_id = coalesce(p_store_user_id, store_user_id),
      status = p_status,
      failure_code = nullif(btrim(coalesce(p_failure_code, '')), ''),
      consumed_at = case when p_status = 'consumed' then now() else consumed_at end,
      updated_at = now()
  where id = p_event_id
    and status = 'pending';

  if not found then
    raise exception 'handoff_event_not_pending_or_missing' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.register_entiznet_handoff(text,uuid,text,text,text,text[],timestamptz,timestamptz,jsonb)
  from public, anon, authenticated;
grant execute on function public.register_entiznet_handoff(text,uuid,text,text,text,text[],timestamptz,timestamptz,jsonb)
  to service_role;
revoke all on function public.complete_entiznet_handoff(uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.complete_entiznet_handoff(uuid,uuid,text,text)
  to service_role;

commit;
