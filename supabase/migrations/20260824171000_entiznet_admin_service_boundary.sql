-- EntizNetStore — scoped EntizNet Admin service boundary.
-- EntizNet must never hold this Store project's Supabase service-role key.
-- Cross-product Admin requests are authenticated at the Store HTTP boundary
-- with short-lived Ed25519 assertions and recorded here for replay/audit.

begin;

create table if not exists public.entiznet_admin_api_requests (
  id uuid primary key default gen_random_uuid(),
  jti_hash text not null unique,
  entiznet_admin_id uuid not null,
  issuer text not null,
  audience text not null,
  scopes text[] not null default '{}'::text[],
  route text not null,
  method text not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'pending'
    constraint entiznet_admin_api_requests_status_check
    check (status in ('pending', 'completed', 'rejected')),
  failure_code text,
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entiznet_admin_api_requests_ttl_check
    check (expires_at > issued_at and expires_at <= issued_at + interval '2 minutes')
);

alter table public.entiznet_admin_api_requests enable row level security;
revoke all on public.entiznet_admin_api_requests from public, anon, authenticated;
grant select, insert, update, delete on public.entiznet_admin_api_requests to service_role;

create index if not exists idx_entiznet_admin_api_requests_actor_created
  on public.entiznet_admin_api_requests(entiznet_admin_id, created_at desc);
create index if not exists idx_entiznet_admin_api_requests_status_created
  on public.entiznet_admin_api_requests(status, created_at desc);
create index if not exists idx_entiznet_admin_api_requests_expires
  on public.entiznet_admin_api_requests(expires_at);

create or replace function public.register_entiznet_admin_api_request(
  p_jti_hash text,
  p_entiznet_admin_id uuid,
  p_issuer text,
  p_audience text,
  p_scopes text[],
  p_route text,
  p_method text,
  p_issued_at timestamptz,
  p_expires_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
begin
  if p_jti_hash is null or char_length(p_jti_hash) <> 64 or p_jti_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_integration_jti_hash' using errcode = '22023';
  end if;
  if p_entiznet_admin_id is null then
    raise exception 'integration_actor_required' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_issuer, '')), '') is null
     or nullif(btrim(coalesce(p_audience, '')), '') is null then
    raise exception 'integration_issuer_audience_required' using errcode = '22023';
  end if;
  if coalesce(array_length(p_scopes, 1), 0) < 1
     or coalesce(array_length(p_scopes, 1), 0) > 10 then
    raise exception 'invalid_integration_scopes' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_route, '')), '') is null or char_length(p_route) > 300
     or nullif(btrim(coalesce(p_method, '')), '') is null or char_length(p_method) > 10 then
    raise exception 'invalid_integration_route' using errcode = '22023';
  end if;
  if p_issued_at is null or p_expires_at is null
     or p_expires_at <= p_issued_at
     or p_expires_at > p_issued_at + interval '2 minutes'
     or p_expires_at <= now() then
    raise exception 'invalid_or_expired_integration_request' using errcode = '22023';
  end if;

  insert into public.entiznet_admin_api_requests(
    jti_hash, entiznet_admin_id, issuer, audience, scopes, route, method,
    issued_at, expires_at, metadata
  ) values (
    lower(p_jti_hash), p_entiznet_admin_id, btrim(p_issuer), btrim(p_audience),
    p_scopes, btrim(p_route), upper(btrim(p_method)), p_issued_at, p_expires_at,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'integration_request_replay_detected' using errcode = '23505';
end;
$$;

create or replace function public.complete_entiznet_admin_api_request(
  p_request_id uuid,
  p_status text,
  p_failure_code text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text := lower(btrim(coalesce(p_status, '')));
begin
  if v_status not in ('completed', 'rejected') then
    raise exception 'invalid_integration_request_status' using errcode = '22023';
  end if;

  update public.entiznet_admin_api_requests
  set status = v_status,
      failure_code = case when v_status = 'rejected' then nullif(left(coalesce(p_failure_code, ''), 160), '') else null end,
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
      completed_at = now(),
      updated_at = now()
  where id = p_request_id and status = 'pending';

  if not found then
    raise exception 'integration_request_not_pending' using errcode = '22023';
  end if;
end;
$$;

-- Canonical Store account read model for a verified external EntizNet Admin.
-- This function is service-role-only; the HTTP layer verifies the signed
-- EntizNet assertion and records the request before invoking it.
create or replace function public.entiznet_admin_search_marketplace_accounts(
  p_entiznet_admin_id uuid,
  p_query text,
  p_capability text,
  p_status text,
  p_limit integer,
  p_offset integer
)
returns table(
  user_id uuid,
  email text,
  auth_created_at timestamptz,
  buyer_display_name text,
  has_buyer boolean,
  buyer_status text,
  has_seller boolean,
  seller_storefront_name text,
  seller_verification_status text,
  seller_status text,
  has_business boolean,
  business_display_name text,
  business_verification_status text,
  business_status text,
  entiznet_user_id uuid,
  entiznet_link_status text,
  total_count bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_query text := lower(btrim(coalesce(p_query, '')));
  v_capability text := lower(btrim(coalesce(p_capability, 'all')));
  v_status text := lower(btrim(coalesce(p_status, 'all')));
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if p_entiznet_admin_id is null then
    raise exception 'integration_actor_required' using errcode = '22023';
  end if;
  if v_capability not in ('all', 'buyer', 'seller', 'business') then
    raise exception 'invalid_account_capability_filter' using errcode = '22023';
  end if;
  if v_status not in ('all', 'active', 'suspended') then
    raise exception 'invalid_account_status_filter' using errcode = '22023';
  end if;
  if char_length(v_query) > 200 then
    raise exception 'account_search_query_too_long' using errcode = '22023';
  end if;

  return query
  with account_rows as (
    select
      u.id as user_id,
      u.email::text as email,
      u.created_at as auth_created_at,
      pb.display_name as buyer_display_name,
      (pb.id is not null) as has_buyer,
      case when pb.id is null then null
           when public.marketplace_capability_is_active(u.id, 'buyer') then 'active'
           else 'suspended' end as buyer_status,
      (ps.id is not null) as has_seller,
      ps.storefront_name as seller_storefront_name,
      ps.verification_status as seller_verification_status,
      case when ps.id is null then null
           when public.marketplace_capability_is_active(u.id, 'seller') then 'active'
           else 'suspended' end as seller_status,
      (pbus.id is not null) as has_business,
      pbus.display_name as business_display_name,
      pbus.verification_status as business_verification_status,
      case when pbus.id is null then null
           when public.marketplace_capability_is_active(u.id, 'business') then 'active'
           else 'suspended' end as business_status,
      eil.entiznet_user_id,
      eil.status as entiznet_link_status
    from auth.users u
    left join public.profiles_buyer pb on pb.id = u.id
    left join public.profiles_seller ps on ps.id = u.id
    left join public.profiles_business pbus on pbus.id = u.id
    left join public.entiznet_identity_links eil on eil.store_user_id = u.id
    where
      (
        v_query = ''
        or lower(coalesce(u.email::text, '')) like '%' || v_query || '%'
        or lower(coalesce(pb.display_name, '')) like '%' || v_query || '%'
        or lower(coalesce(ps.storefront_name, '')) like '%' || v_query || '%'
        or lower(coalesce(pbus.display_name, '')) like '%' || v_query || '%'
        or u.id::text = v_query
        or eil.entiznet_user_id::text = v_query
      )
      and (
        v_capability = 'all'
        or (v_capability = 'buyer' and pb.id is not null)
        or (v_capability = 'seller' and ps.id is not null)
        or (v_capability = 'business' and pbus.id is not null)
      )
  ), filtered as (
    select * from account_rows a
    where
      v_status = 'all'
      or (
        v_status = 'active'
        and (
          (v_capability in ('all', 'buyer') and a.has_buyer and a.buyer_status = 'active')
          or (v_capability in ('all', 'seller') and a.has_seller and a.seller_status = 'active')
          or (v_capability in ('all', 'business') and a.has_business and a.business_status = 'active')
        )
      )
      or (
        v_status = 'suspended'
        and (
          (v_capability in ('all', 'buyer') and a.has_buyer and a.buyer_status = 'suspended')
          or (v_capability in ('all', 'seller') and a.has_seller and a.seller_status = 'suspended')
          or (v_capability in ('all', 'business') and a.has_business and a.business_status = 'suspended')
        )
      )
  )
  select
    f.user_id, f.email, f.auth_created_at,
    f.buyer_display_name, f.has_buyer, f.buyer_status,
    f.has_seller, f.seller_storefront_name, f.seller_verification_status, f.seller_status,
    f.has_business, f.business_display_name, f.business_verification_status, f.business_status,
    f.entiznet_user_id, f.entiznet_link_status,
    count(*) over() as total_count
  from filtered f
  order by f.auth_created_at desc, f.user_id
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.register_entiznet_admin_api_request(text,uuid,text,text,text[],text,text,timestamptz,timestamptz,jsonb)
  from public, anon, authenticated;
grant execute on function public.register_entiznet_admin_api_request(text,uuid,text,text,text[],text,text,timestamptz,timestamptz,jsonb)
  to service_role;

revoke all on function public.complete_entiznet_admin_api_request(uuid,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_entiznet_admin_api_request(uuid,text,text,jsonb)
  to service_role;

revoke all on function public.entiznet_admin_search_marketplace_accounts(uuid,text,text,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.entiznet_admin_search_marketplace_accounts(uuid,text,text,text,integer,integer)
  to service_role;

commit;
