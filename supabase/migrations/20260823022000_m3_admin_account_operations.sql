-- EntizNetStore combined M3 — trusted Admin account operations.

begin;

create or replace function public.admin_search_marketplace_accounts(
  p_admin_id uuid,
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
  if p_admin_id is null
     or not exists (
       select 1 from auth.users u
       where u.id = p_admin_id
         and u.raw_app_meta_data->>'role' = 'admin'
     ) then
    raise exception 'admin_authorization_required' using errcode = '42501';
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

revoke all on function public.admin_search_marketplace_accounts(uuid,text,text,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.admin_search_marketplace_accounts(uuid,text,text,text,integer,integer)
  to service_role;

create or replace function public.admin_get_marketplace_account(
  p_admin_id uuid,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_result jsonb;
begin
  if p_admin_id is null
     or not exists (
       select 1 from auth.users u
       where u.id = p_admin_id
         and u.raw_app_meta_data->>'role' = 'admin'
     ) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'userId', u.id,
    'email', u.email,
    'authCreatedAt', u.created_at,
    'lastSignInAt', u.last_sign_in_at,
    'buyer', case when pb.id is null then null else jsonb_build_object(
      'displayName', pb.display_name,
      'firstName', pb.first_name,
      'lastName', pb.last_name,
      'country', pb.country,
      'phone', pb.phone,
      'status', case when public.marketplace_capability_is_active(u.id, 'buyer') then 'active' else 'suspended' end
    ) end,
    'seller', case when ps.id is null then null else jsonb_build_object(
      'storefrontName', ps.storefront_name,
      'storeSlug', ps.store_slug,
      'verificationStatus', ps.verification_status,
      'businessType', ps.business_type,
      'status', case when public.marketplace_capability_is_active(u.id, 'seller') then 'active' else 'suspended' end
    ) end,
    'business', case when pbus.id is null then null else jsonb_build_object(
      'displayName', pbus.display_name,
      'legalName', pbus.legal_name,
      'businessKind', pbus.business_kind,
      'verificationStatus', pbus.verification_status,
      'status', case when public.marketplace_capability_is_active(u.id, 'business') then 'active' else 'suspended' end
    ) end,
    'entiznetLink', case when eil.id is null then null else jsonb_build_object(
      'entiznetUserId', eil.entiznet_user_id,
      'status', eil.status,
      'capabilitiesSnapshot', eil.capabilities_snapshot,
      'capabilitiesVersion', eil.capabilities_version,
      'linkedAt', eil.linked_at,
      'lastSyncedAt', eil.last_synced_at,
      'revokedAt', eil.revoked_at,
      'revokedReason', eil.revoked_reason
    ) end,
    'capabilityStates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'capability', s.capability,
        'status', s.status,
        'reason', s.reason,
        'suspendedAt', s.suspended_at,
        'suspendedBy', s.suspended_by,
        'restoredAt', s.restored_at,
        'restoredBy', s.restored_by,
        'updatedAt', s.updated_at
      ) order by s.capability)
      from public.marketplace_capability_states s
      where s.user_id = u.id
    ), '[]'::jsonb),
    'recentCapabilityEvents', coalesce((
      select jsonb_agg(event_row order by (event_row->>'createdAt') desc)
      from (
        select jsonb_build_object(
          'id', e.id,
          'capability', e.capability,
          'oldStatus', e.old_status,
          'newStatus', e.new_status,
          'reason', e.reason,
          'actorId', e.actor_id,
          'actorType', e.actor_type,
          'createdAt', e.created_at
        ) as event_row
        from public.marketplace_capability_state_events e
        where e.user_id = u.id
        order by e.created_at desc
        limit 50
      ) recent
    ), '[]'::jsonb)
  ) into v_result
  from auth.users u
  left join public.profiles_buyer pb on pb.id = u.id
  left join public.profiles_seller ps on ps.id = u.id
  left join public.profiles_business pbus on pbus.id = u.id
  left join public.entiznet_identity_links eil on eil.store_user_id = u.id
  where u.id = p_target_user_id;

  if v_result is null then
    raise exception 'marketplace_account_not_found' using errcode = '22023';
  end if;

  return v_result;
end;
$$;

revoke all on function public.admin_get_marketplace_account(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.admin_get_marketplace_account(uuid,uuid)
  to service_role;

commit;
