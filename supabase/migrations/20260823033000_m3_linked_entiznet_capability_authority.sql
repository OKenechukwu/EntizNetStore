-- EntizNetStore combined M3 — linked identity capability authority.
--
-- Unlinked standalone Store accounts continue to use local profile existence +
-- local suspension state. Once an account is linked to EntizNet, the active
-- EntizNet capability snapshot becomes the capability source of truth while
-- local Store suspension remains an additional deny. Historical profile/order
-- data is never deleted when an upstream capability is removed.

begin;

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
declare
  v_link public.entiznet_identity_links%rowtype;
  v_required_slug text;
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

  select * into v_link
  from public.entiznet_identity_links
  where store_user_id = p_user_id
  limit 1;

  if found then
    if v_link.status <> 'active' then
      return false;
    end if;

    v_required_slug := case p_capability
      when 'buyer' then 'entiznetstore_buyer'
      when 'seller' then 'entiznetstore_seller'
      when 'business' then 'entiznetstore_business'
    end;

    -- EntizStore Business is the Store BSM capability and therefore includes
    -- Buyer + Seller + Business access in the Store domain model.
    if not (
      v_required_slug = any(v_link.capabilities_snapshot)
      or (
        p_capability in ('buyer', 'seller')
        and 'entiznetstore_business' = any(v_link.capabilities_snapshot)
      )
    ) then
      return false;
    end if;
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

-- Resolve a confirmed EntizNet email to an existing Store auth identity without
-- copying auth email into a second application identity table.
create or replace function public.resolve_store_auth_user_by_email(p_email text)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, auth
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user_id uuid;
begin
  if v_email = '' or char_length(v_email) > 320 or position('@' in v_email) < 2 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;

  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = v_email
  limit 1;

  return v_user_id;
end;
$$;

revoke all on function public.resolve_store_auth_user_by_email(text)
  from public, anon, authenticated;
grant execute on function public.resolve_store_auth_user_by_email(text)
  to service_role;

-- Materialize the Store profile rows required by an authenticated EntizNet
-- capability assertion. Removing a capability does not delete profile/history;
-- marketplace_capability_is_active() denies it from the latest linked snapshot.
create or replace function public.sync_entiznet_store_capabilities(
  p_store_user_id uuid,
  p_capabilities text[],
  p_display_name text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_cap text;
  v_display text := left(coalesce(nullif(btrim(p_display_name), ''), 'EntizNet User'), 120);
  v_has_buyer boolean;
  v_has_seller boolean;
  v_has_business boolean;
begin
  if p_store_user_id is null
     or not exists (select 1 from auth.users where id = p_store_user_id) then
    raise exception 'store_user_not_found' using errcode = '22023';
  end if;

  foreach v_cap in array coalesce(p_capabilities, '{}'::text[]) loop
    if v_cap not in ('entiznetstore_buyer','entiznetstore_seller','entiznetstore_business') then
      raise exception 'unsupported_entiznetstore_capability: %', v_cap using errcode = '22023';
    end if;
  end loop;

  v_has_business := 'entiznetstore_business' = any(coalesce(p_capabilities, '{}'::text[]));
  v_has_buyer := v_has_business or 'entiznetstore_buyer' = any(coalesce(p_capabilities, '{}'::text[]));
  v_has_seller := v_has_business or 'entiznetstore_seller' = any(coalesce(p_capabilities, '{}'::text[]));

  if v_has_buyer then
    insert into public.profiles_buyer(id, display_name, created_at, updated_at)
    values (p_store_user_id, v_display, now(), now())
    on conflict (id) do update
      set display_name = coalesce(public.profiles_buyer.display_name, excluded.display_name),
          updated_at = now();
  end if;

  if v_has_seller then
    insert into public.profiles_seller(
      id, storefront_name, business_type, verification_status, created_at, updated_at
    ) values (
      p_store_user_id,
      left(v_display || ' Store', 160),
      case when v_has_business then 'business' else 'individual' end,
      'pending',
      now(), now()
    )
    on conflict (id) do update
      set updated_at = now();
  end if;

  if v_has_business then
    insert into public.profiles_business(
      id, display_name, business_kind, verification_status, created_at, updated_at
    ) values (
      p_store_user_id, v_display, 'brand', 'pending', now(), now()
    )
    on conflict (id) do update
      set updated_at = now();
  end if;
end;
$$;

revoke all on function public.sync_entiznet_store_capabilities(uuid,text[],text)
  from public, anon, authenticated;
grant execute on function public.sync_entiznet_store_capabilities(uuid,text[],text)
  to service_role;

commit;
