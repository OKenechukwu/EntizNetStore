-- EntizNetStore combined M3 — enforce capability-specific operational state
-- through catalogue visibility and commerce mutation boundaries.

begin;

-- ---------------------------------------------------------------------------
-- Public catalogue must disappear immediately when Seller capability is
-- suspended, without destroying KYC verification or product moderation state.
-- ---------------------------------------------------------------------------
drop policy if exists products_anon_select on public.products;
create policy products_anon_select on public.products
for select to anon
using (
  status = 'active'
  and moderation_status = 'approved'
  and public.marketplace_capability_is_active(seller_id, 'seller')
  and exists (
    select 1 from public.profiles_seller s
    where s.id = products.seller_id
      and s.verification_status = 'verified'
  )
);

drop policy if exists products_authenticated_select on public.products;
create policy products_authenticated_select on public.products
for select to authenticated
using (
  seller_id = (select auth.uid())
  or (
    status = 'active'
    and moderation_status = 'approved'
    and public.marketplace_capability_is_active(seller_id, 'seller')
    and exists (
      select 1 from public.profiles_seller s
      where s.id = products.seller_id
        and s.verification_status = 'verified'
    )
  )
);

drop policy if exists product_variants_anon_select on public.product_variants;
create policy product_variants_anon_select on public.product_variants
for select to anon
using (exists (
  select 1 from public.products p
  join public.profiles_seller s on s.id = p.seller_id
  where p.id = product_variants.product_id
    and p.status = 'active'
    and p.moderation_status = 'approved'
    and s.verification_status = 'verified'
    and public.marketplace_capability_is_active(p.seller_id, 'seller')
));

drop policy if exists product_variants_authenticated_select on public.product_variants;
create policy product_variants_authenticated_select on public.product_variants
for select to authenticated
using (exists (
  select 1 from public.products p
  where p.id = product_variants.product_id
    and (
      p.seller_id = (select auth.uid())
      or (
        p.status = 'active'
        and p.moderation_status = 'approved'
        and public.marketplace_capability_is_active(p.seller_id, 'seller')
        and exists (
          select 1 from public.profiles_seller s
          where s.id = p.seller_id and s.verification_status = 'verified'
        )
      )
    )
));

drop policy if exists product_media_anon_select on public.product_media;
create policy product_media_anon_select on public.product_media
for select to anon
using (exists (
  select 1 from public.products p
  join public.profiles_seller s on s.id = p.seller_id
  where p.id = product_media.product_id
    and p.status = 'active'
    and p.moderation_status = 'approved'
    and s.verification_status = 'verified'
    and public.marketplace_capability_is_active(p.seller_id, 'seller')
));

drop policy if exists product_media_authenticated_select on public.product_media;
create policy product_media_authenticated_select on public.product_media
for select to authenticated
using (exists (
  select 1 from public.products p
  where p.id = product_media.product_id
    and (
      p.seller_id = (select auth.uid())
      or (
        p.status = 'active'
        and p.moderation_status = 'approved'
        and public.marketplace_capability_is_active(p.seller_id, 'seller')
        and exists (
          select 1 from public.profiles_seller s
          where s.id = p.seller_id and s.verification_status = 'verified'
        )
      )
    )
));

drop policy if exists product_categories_anon_select on public.product_categories;
create policy product_categories_anon_select on public.product_categories
for select to anon
using (exists (
  select 1 from public.products p
  join public.profiles_seller s on s.id = p.seller_id
  where p.id = product_categories.product_id
    and p.status = 'active'
    and p.moderation_status = 'approved'
    and s.verification_status = 'verified'
    and public.marketplace_capability_is_active(p.seller_id, 'seller')
));

drop policy if exists product_categories_authenticated_select on public.product_categories;
create policy product_categories_authenticated_select on public.product_categories
for select to authenticated
using (exists (
  select 1 from public.products p
  where p.id = product_categories.product_id
    and (
      p.seller_id = (select auth.uid())
      or (
        p.status = 'active'
        and p.moderation_status = 'approved'
        and public.marketplace_capability_is_active(p.seller_id, 'seller')
        and exists (
          select 1 from public.profiles_seller s
          where s.id = p.seller_id and s.verification_status = 'verified'
        )
      )
    )
));

-- ---------------------------------------------------------------------------
-- Seller mutation guard. Seller catalogue RPCs are SECURITY DEFINER, so this
-- trigger is the shared final boundary across create/edit/submit/publish/delete.
-- Trusted service-role/Admin work has no user auth.uid() and bypasses this user
-- guard intentionally.
-- ---------------------------------------------------------------------------
create or replace function public.guard_seller_capability_for_product_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_seller uuid := case when tg_op = 'DELETE' then old.seller_id else new.seller_id end;
begin
  if v_actor is not null
     and v_actor = v_seller
     and not public.marketplace_capability_is_active(v_actor, 'seller') then
    raise exception 'seller_capability_suspended' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.guard_seller_capability_for_product_mutation()
  from public, anon, authenticated;
grant execute on function public.guard_seller_capability_for_product_mutation()
  to service_role;

drop trigger if exists trg_guard_seller_capability_product_mutation on public.products;
create trigger trg_guard_seller_capability_product_mutation
before insert or update or delete on public.products
for each row execute function public.guard_seller_capability_for_product_mutation();

-- ---------------------------------------------------------------------------
-- Buyer cart/checkout guards. A suspended Buyer may still read historical
-- orders and may cancel/recover existing state through explicit trusted paths,
-- but cannot create new cart commerce or a new checkout session.
-- ---------------------------------------------------------------------------
create or replace function public.guard_buyer_capability_for_cart_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_buyer uuid := case when tg_op = 'DELETE' then old.buyer_id else new.buyer_id end;
begin
  if tg_op <> 'DELETE'
     and v_actor is not null
     and v_actor = v_buyer
     and not public.marketplace_capability_is_active(v_actor, 'buyer') then
    raise exception 'buyer_capability_suspended' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.guard_capabilities_for_cart_item_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_cart_id uuid := case when tg_op = 'DELETE' then old.cart_id else new.cart_id end;
  v_product_id uuid := case when tg_op = 'DELETE' then old.product_id else new.product_id end;
  v_buyer uuid;
  v_seller uuid;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  select buyer_id into v_buyer from public.carts where id = v_cart_id;
  select seller_id into v_seller from public.products where id = v_product_id;

  if v_actor is not null and v_actor = v_buyer
     and not public.marketplace_capability_is_active(v_buyer, 'buyer') then
    raise exception 'buyer_capability_suspended' using errcode = '42501';
  end if;

  if v_seller is null
     or not public.marketplace_capability_is_active(v_seller, 'seller') then
    raise exception 'seller_capability_suspended' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.guard_buyer_capability_for_checkout_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is not null
     and v_actor = new.buyer_id
     and not public.marketplace_capability_is_active(new.buyer_id, 'buyer') then
    raise exception 'buyer_capability_suspended' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_buyer_capability_for_cart_mutation() from public, anon, authenticated;
revoke all on function public.guard_capabilities_for_cart_item_mutation() from public, anon, authenticated;
revoke all on function public.guard_buyer_capability_for_checkout_insert() from public, anon, authenticated;
grant execute on function public.guard_buyer_capability_for_cart_mutation(),
  public.guard_capabilities_for_cart_item_mutation(),
  public.guard_buyer_capability_for_checkout_insert()
  to service_role;

drop trigger if exists trg_guard_buyer_capability_cart_mutation on public.carts;
create trigger trg_guard_buyer_capability_cart_mutation
before insert or update on public.carts
for each row execute function public.guard_buyer_capability_for_cart_mutation();

drop trigger if exists trg_guard_capabilities_cart_item_mutation on public.cart_items;
create trigger trg_guard_capabilities_cart_item_mutation
before insert or update on public.cart_items
for each row execute function public.guard_capabilities_for_cart_item_mutation();

drop trigger if exists trg_guard_buyer_capability_checkout_insert on public.payment_sessions;
create trigger trg_guard_buyer_capability_checkout_insert
before insert on public.payment_sessions
for each row execute function public.guard_buyer_capability_for_checkout_insert();

commit;
