-- EntizNetStore P0 — reduce browser-callable SECURITY DEFINER surface for cart mutations.
--
-- Public Data API RPCs become SECURITY INVOKER wrappers. Privileged mutation
-- implementations live in non-exposed app_private and continue deriving the
-- Buyer exclusively from auth.uid(). No caller-supplied Buyer identity is added.

begin;

create or replace function app_private.buyer_get_or_create_cart_authority()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_cart_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles_buyer where id = v_user_id) then
    raise exception 'buyer_profile_required' using errcode = '42501';
  end if;

  select id into v_cart_id
  from public.carts
  where buyer_id = v_user_id and status = 'active'
  order by created_at desc
  limit 1;

  if v_cart_id is null then
    begin
      insert into public.carts(buyer_id)
      values (v_user_id)
      returning id into v_cart_id;
    exception when unique_violation then
      select id into v_cart_id
      from public.carts
      where buyer_id = v_user_id and status = 'active'
      order by created_at desc
      limit 1;
    end;
  end if;

  return v_cart_id;
end;
$$;

create or replace function app_private.buyer_set_cart_item_authority(
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_cart_id uuid;
  v_item_id uuid;
  v_variant record;
  v_reserved integer := 0;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 100 then
    raise exception 'invalid_item_quantity' using errcode = '22023';
  end if;

  select p.id as product_id,
         pv.id as variant_id,
         pv.track_inventory,
         pv.inventory_quantity,
         pv.inventory_policy
    into v_variant
  from public.products p
  join public.profiles_seller s on s.id = p.seller_id
  join public.product_variants pv on pv.product_id = p.id
  where p.id = p_product_id
    and pv.id = p_variant_id
    and p.status = 'active'
    and p.moderation_status = 'approved'
    and s.verification_status = 'verified'
    and app_private.marketplace_capability_is_active(p.seller_id, 'seller')
    and pv.is_active;

  if v_variant.variant_id is null then
    raise exception 'product_variant_unavailable' using errcode = '22023';
  end if;

  if v_variant.track_inventory and v_variant.inventory_policy = 'deny' then
    select coalesce(sum(r.quantity), 0)::integer
      into v_reserved
    from public.inventory_reservations r
    where r.variant_id = p_variant_id
      and r.status = 'pending'
      and r.expires_at > now();

    if v_variant.inventory_quantity - v_reserved < p_quantity then
      raise exception 'insufficient_inventory' using errcode = '22023';
    end if;
  end if;

  v_cart_id := app_private.buyer_get_or_create_cart_authority();

  insert into public.cart_items(
    cart_id, product_id, variant_id, quantity, purchase_mode, wholesale_offer_id
  ) values (
    v_cart_id, p_product_id, p_variant_id, p_quantity, 'retail', null
  )
  on conflict (cart_id, variant_id, purchase_mode)
  do update set product_id = excluded.product_id,
                quantity = excluded.quantity,
                wholesale_offer_id = null,
                updated_at = now()
  returning id into v_item_id;

  update public.carts
  set version = version + 1,
      updated_at = now()
  where id = v_cart_id and buyer_id = v_user_id and status = 'active';

  return v_item_id;
end;
$$;

create or replace function app_private.buyer_remove_cart_item_authority(
  p_cart_item_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_cart_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select ci.cart_id into v_cart_id
  from public.cart_items ci
  join public.carts c on c.id = ci.cart_id
  where ci.id = p_cart_item_id
    and c.buyer_id = v_user_id
    and c.status = 'active'
  for update of c;

  if v_cart_id is null then
    raise exception 'cart_item_not_found_or_access_denied' using errcode = '42501';
  end if;

  delete from public.cart_items
  where id = p_cart_item_id and cart_id = v_cart_id;

  update public.carts
  set version = version + 1,
      updated_at = now()
  where id = v_cart_id;
end;
$$;

create or replace function app_private.buyer_clear_cart_authority()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_cart_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select id into v_cart_id
  from public.carts
  where buyer_id = v_user_id and status = 'active'
  for update;

  if v_cart_id is null then
    return;
  end if;

  delete from public.cart_items where cart_id = v_cart_id;
  update public.carts
  set version = version + 1,
      updated_at = now()
  where id = v_cart_id;
end;
$$;

create or replace function app_private.buyer_set_wholesale_cart_item_authority(
  p_offer_id uuid,
  p_quantity integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_cart_id uuid;
  v_item_id uuid;
  v_offer record;
  v_reserved integer := 0;
  v_tier_price bigint;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 100000 then
    raise exception 'invalid_wholesale_quantity' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles_buyer where id = v_user_id) then
    raise exception 'buyer_profile_required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles_business
    where id = v_user_id and verification_status = 'verified'
  ) then
    raise exception 'verified_business_buyer_required' using errcode = '42501';
  end if;
  if not app_private.marketplace_capability_is_active(v_user_id, 'buyer')
     or not app_private.marketplace_capability_is_active(v_user_id, 'business') then
    raise exception 'buyer_or_business_capability_suspended' using errcode = '42501';
  end if;

  select wo.id, wo.seller_id, wo.product_id, wo.variant_id, wo.status,
         wo.minimum_order_quantity, wo.order_multiple, wo.starts_at, wo.ends_at,
         pv.track_inventory, pv.inventory_quantity, pv.inventory_policy
    into v_offer
  from public.wholesale_offers wo
  join public.profiles_business b on b.id = wo.seller_id
  join public.profiles_seller s on s.id = wo.seller_id
  join public.products p on p.id = wo.product_id and p.seller_id = wo.seller_id
  join public.product_variants pv on pv.id = wo.variant_id and pv.product_id = p.id
  where wo.id = p_offer_id
    and wo.status = 'active'
    and (wo.starts_at is null or wo.starts_at <= now())
    and (wo.ends_at is null or wo.ends_at > now())
    and b.verification_status = 'verified'
    and s.verification_status = 'verified'
    and p.status = 'active'
    and p.moderation_status = 'approved'
    and pv.is_active;

  if v_offer.id is null
     or not app_private.marketplace_capability_is_active(v_offer.seller_id, 'seller')
     or not app_private.marketplace_capability_is_active(v_offer.seller_id, 'business') then
    raise exception 'wholesale_offer_unavailable' using errcode = '22023';
  end if;

  if p_quantity < v_offer.minimum_order_quantity
     or ((p_quantity - v_offer.minimum_order_quantity) % v_offer.order_multiple) <> 0 then
    raise exception 'wholesale_quantity_does_not_meet_offer_terms' using errcode = '22023';
  end if;

  select tier.unit_price_cents into v_tier_price
  from public.wholesale_offer_tiers tier
  where tier.offer_id = v_offer.id
    and tier.minimum_quantity <= p_quantity
  order by tier.minimum_quantity desc
  limit 1;

  if v_tier_price is null then
    raise exception 'wholesale_pricing_tier_unavailable' using errcode = '22023';
  end if;

  if v_offer.track_inventory and v_offer.inventory_policy = 'deny' then
    select coalesce(sum(r.quantity), 0)::integer
      into v_reserved
    from public.inventory_reservations r
    where r.variant_id = v_offer.variant_id
      and r.status = 'pending'
      and r.expires_at > now();

    if v_offer.inventory_quantity - v_reserved < p_quantity then
      raise exception 'insufficient_inventory' using errcode = '22023';
    end if;
  end if;

  v_cart_id := app_private.buyer_get_or_create_cart_authority();

  insert into public.cart_items(
    cart_id, product_id, variant_id, quantity, purchase_mode, wholesale_offer_id
  ) values (
    v_cart_id, v_offer.product_id, v_offer.variant_id, p_quantity, 'wholesale', v_offer.id
  )
  on conflict (cart_id, variant_id, purchase_mode)
  do update set product_id = excluded.product_id,
                quantity = excluded.quantity,
                wholesale_offer_id = excluded.wholesale_offer_id,
                updated_at = now()
  returning id into v_item_id;

  update public.carts
  set version = version + 1,
      updated_at = now()
  where id = v_cart_id and buyer_id = v_user_id and status = 'active';

  return v_item_id;
end;
$$;

-- Public Data API functions retain their names/signatures but no longer execute
-- with owner privileges. They delegate to the non-exposed authorities above.
create or replace function public.buyer_get_or_create_cart()
returns uuid
language sql
security invoker
set search_path = 'pg_catalog'
as $$
  select app_private.buyer_get_or_create_cart_authority();
$$;

create or replace function public.buyer_set_cart_item(
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity integer
)
returns uuid
language sql
security invoker
set search_path = 'pg_catalog'
as $$
  select app_private.buyer_set_cart_item_authority(p_product_id, p_variant_id, p_quantity);
$$;

create or replace function public.buyer_remove_cart_item(p_cart_item_id uuid)
returns void
language sql
security invoker
set search_path = 'pg_catalog'
as $$
  select app_private.buyer_remove_cart_item_authority(p_cart_item_id);
$$;

create or replace function public.buyer_clear_cart()
returns void
language sql
security invoker
set search_path = 'pg_catalog'
as $$
  select app_private.buyer_clear_cart_authority();
$$;

create or replace function public.buyer_set_wholesale_cart_item(
  p_offer_id uuid,
  p_quantity integer
)
returns uuid
language sql
security invoker
set search_path = 'pg_catalog'
as $$
  select app_private.buyer_set_wholesale_cart_item_authority(p_offer_id, p_quantity);
$$;

-- PostgreSQL grants EXECUTE to PUBLIC by default on new functions. Freeze both
-- exposed wrappers and hidden authorities to the pre-existing callable roles.
grant usage on schema app_private to authenticated, service_role;

revoke all on function app_private.buyer_get_or_create_cart_authority() from public, anon;
revoke all on function app_private.buyer_set_cart_item_authority(uuid,uuid,integer) from public, anon;
revoke all on function app_private.buyer_remove_cart_item_authority(uuid) from public, anon;
revoke all on function app_private.buyer_clear_cart_authority() from public, anon;
revoke all on function app_private.buyer_set_wholesale_cart_item_authority(uuid,integer) from public, anon;
grant execute on function app_private.buyer_get_or_create_cart_authority() to authenticated, service_role;
grant execute on function app_private.buyer_set_cart_item_authority(uuid,uuid,integer) to authenticated, service_role;
grant execute on function app_private.buyer_remove_cart_item_authority(uuid) to authenticated, service_role;
grant execute on function app_private.buyer_clear_cart_authority() to authenticated, service_role;
grant execute on function app_private.buyer_set_wholesale_cart_item_authority(uuid,integer) to authenticated, service_role;

revoke all on function public.buyer_get_or_create_cart() from public, anon;
revoke all on function public.buyer_set_cart_item(uuid,uuid,integer) from public, anon;
revoke all on function public.buyer_remove_cart_item(uuid) from public, anon;
revoke all on function public.buyer_clear_cart() from public, anon;
revoke all on function public.buyer_set_wholesale_cart_item(uuid,integer) from public, anon;
grant execute on function public.buyer_get_or_create_cart() to authenticated, service_role;
grant execute on function public.buyer_set_cart_item(uuid,uuid,integer) to authenticated, service_role;
grant execute on function public.buyer_remove_cart_item(uuid) to authenticated, service_role;
grant execute on function public.buyer_clear_cart() to authenticated, service_role;
grant execute on function public.buyer_set_wholesale_cart_item(uuid,integer) to authenticated, service_role;

-- Hosted advisor: cover the settlement confirmation actor FK. Keep the existing
-- seller/buyer time indexes unchanged; this index serves confirmed_by joins/FK work.
create index if not exists idx_order_settlement_confirmations_confirmed_by
  on private.order_settlement_confirmations(confirmed_by);

commit;
