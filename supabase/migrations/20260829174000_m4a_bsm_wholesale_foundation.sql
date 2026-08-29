-- EntizNetStore M4A — BSM wholesale marketplace commerce authority.
--
-- Wholesale extends the canonical M3 cart -> trusted quote -> checkout/order
-- pipeline. Browser callers never submit authoritative wholesale prices.
-- Seller/Business mutations remain RPC-only and final checkout revalidates the
-- live offer/tier, Business capability, catalogue state and inventory.

begin;

-- ---------------------------------------------------------------------------
-- Additive Business/BSM trading roles
-- ---------------------------------------------------------------------------
create table if not exists public.business_trading_roles (
  business_id uuid not null references public.profiles_business(id) on delete cascade,
  role text not null
    constraint business_trading_roles_role_check
    check (role in ('brand', 'supplier', 'manufacturer', 'distributor', 'wholesaler', 'retailer', 'other')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (business_id, role)
);

create unique index if not exists business_trading_roles_one_primary
  on public.business_trading_roles(business_id)
  where is_primary;

insert into public.business_trading_roles(business_id, role, is_primary)
select id, business_kind, true
from public.profiles_business
where business_kind in ('brand', 'supplier', 'manufacturer', 'distributor', 'wholesaler', 'retailer', 'other')
on conflict (business_id, role) do nothing;

alter table public.business_trading_roles enable row level security;

drop policy if exists business_trading_roles_authenticated_select on public.business_trading_roles;
create policy business_trading_roles_authenticated_select
on public.business_trading_roles
for select to authenticated
using (
  business_id = (select auth.uid())
  or (
    exists (
      select 1 from public.profiles_business viewer
      where viewer.id = (select auth.uid())
        and viewer.verification_status = 'verified'
    )
    and app_private.marketplace_capability_is_active((select auth.uid()), 'business')
    and exists (
      select 1 from public.profiles_business subject
      where subject.id = business_trading_roles.business_id
        and subject.verification_status = 'verified'
    )
    and app_private.marketplace_capability_is_active(business_trading_roles.business_id, 'business')
  )
);

grant select on public.business_trading_roles to authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.business_trading_roles from anon, authenticated;
grant all on public.business_trading_roles to service_role;

create or replace function public.business_set_trading_roles(p_roles text[])
returns text[]
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_roles text[];
  v_role text;
  v_primary text;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles_business where id = v_user_id) then
    raise exception 'business_profile_required' using errcode = '42501';
  end if;
  if not app_private.marketplace_capability_is_active(v_user_id, 'business') then
    raise exception 'business_capability_suspended' using errcode = '42501';
  end if;
  if p_roles is null or cardinality(p_roles) < 1 or cardinality(p_roles) > 7 then
    raise exception 'invalid_business_trading_roles' using errcode = '22023';
  end if;

  select array_agg(role order by first_ordinality)
    into v_roles
  from (
    select lower(btrim(value)) as role, min(ordinality) as first_ordinality
    from unnest(p_roles) with ordinality as supplied(value, ordinality)
    group by lower(btrim(value))
  ) normalized;

  if v_roles is null or cardinality(v_roles) < 1 then
    raise exception 'invalid_business_trading_roles' using errcode = '22023';
  end if;

  foreach v_role in array v_roles loop
    if v_role not in ('brand', 'supplier', 'manufacturer', 'distributor', 'wholesaler', 'retailer', 'other') then
      raise exception 'invalid_business_trading_role' using errcode = '22023';
    end if;
  end loop;

  v_primary := v_roles[1];

  delete from public.business_trading_roles
  where business_id = v_user_id
    and not (role = any(v_roles));

  update public.business_trading_roles
  set is_primary = false
  where business_id = v_user_id;

  foreach v_role in array v_roles loop
    insert into public.business_trading_roles(business_id, role, is_primary)
    values (v_user_id, v_role, v_role = v_primary)
    on conflict (business_id, role)
    do update set is_primary = excluded.is_primary;
  end loop;

  -- Maintain the legacy primary-kind projection for existing surfaces while
  -- allowing the normalized role set to be additive.
  update public.profiles_business
  set business_kind = v_primary,
      updated_at = now()
  where id = v_user_id;

  return v_roles;
end;
$$;

revoke all on function public.business_set_trading_roles(text[]) from public, anon;
grant execute on function public.business_set_trading_roles(text[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Seller-owned wholesale offers and quantity tiers
-- ---------------------------------------------------------------------------
create table if not exists public.wholesale_offers (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles_business(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  status text not null default 'draft'
    constraint wholesale_offers_status_check
    check (status in ('draft', 'active', 'paused', 'archived')),
  currency text not null default 'usd'
    constraint wholesale_offers_currency_check check (currency = 'usd'),
  minimum_order_quantity integer not null
    constraint wholesale_offers_moq_check check (minimum_order_quantity between 1 and 100000),
  order_multiple integer not null default 1
    constraint wholesale_offers_order_multiple_check check (order_multiple between 1 and 100000),
  unit_label text not null default 'unit'
    constraint wholesale_offers_unit_label_check check (char_length(unit_label) between 1 and 40),
  case_pack_size integer
    constraint wholesale_offers_case_pack_check check (case_pack_size is null or case_pack_size between 1 and 100000),
  lead_time_days integer not null default 0
    constraint wholesale_offers_lead_time_check check (lead_time_days between 0 and 365),
  incoterm text
    constraint wholesale_offers_incoterm_check
    check (incoterm is null or incoterm in ('EXW','FCA','CPT','CIP','DAP','DPU','DDP','FAS','FOB','CFR','CIF')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wholesale_offers_window_check check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint wholesale_offers_moq_multiple_check check ((minimum_order_quantity % order_multiple) = 0),
  constraint wholesale_offers_seller_variant_key unique(seller_id, variant_id)
);

create index if not exists idx_wholesale_offers_active_variant
  on public.wholesale_offers(variant_id, status, updated_at desc);
create index if not exists idx_wholesale_offers_seller_status
  on public.wholesale_offers(seller_id, status, updated_at desc);

create table if not exists public.wholesale_offer_tiers (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.wholesale_offers(id) on delete cascade,
  minimum_quantity integer not null
    constraint wholesale_offer_tiers_minimum_check check (minimum_quantity between 1 and 100000),
  unit_price_cents bigint not null
    constraint wholesale_offer_tiers_price_check check (unit_price_cents between 1 and 100000000000),
  created_at timestamptz not null default now(),
  constraint wholesale_offer_tiers_offer_minimum_key unique(offer_id, minimum_quantity)
);

create index if not exists idx_wholesale_offer_tiers_lookup
  on public.wholesale_offer_tiers(offer_id, minimum_quantity desc);

alter table public.wholesale_offers enable row level security;
alter table public.wholesale_offer_tiers enable row level security;

drop policy if exists wholesale_offers_authenticated_select on public.wholesale_offers;
create policy wholesale_offers_authenticated_select
on public.wholesale_offers
for select to authenticated
using (
  seller_id = (select auth.uid())
  or (
    status = 'active'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
    and exists (
      select 1 from public.profiles_business buyer_business
      where buyer_business.id = (select auth.uid())
        and buyer_business.verification_status = 'verified'
    )
    and app_private.marketplace_capability_is_active((select auth.uid()), 'business')
    and exists (
      select 1
      from public.profiles_business seller_business
      join public.profiles_seller seller_profile on seller_profile.id = seller_business.id
      join public.products product on product.id = wholesale_offers.product_id
      join public.product_variants variant on variant.id = wholesale_offers.variant_id
      where seller_business.id = wholesale_offers.seller_id
        and seller_business.verification_status = 'verified'
        and seller_profile.verification_status = 'verified'
        and product.seller_id = wholesale_offers.seller_id
        and product.status = 'active'
        and product.moderation_status = 'approved'
        and variant.product_id = product.id
        and variant.is_active
        and app_private.marketplace_capability_is_active(wholesale_offers.seller_id, 'seller')
        and app_private.marketplace_capability_is_active(wholesale_offers.seller_id, 'business')
    )
  )
);

drop policy if exists wholesale_offer_tiers_authenticated_select on public.wholesale_offer_tiers;
create policy wholesale_offer_tiers_authenticated_select
on public.wholesale_offer_tiers
for select to authenticated
using (
  exists (
    select 1 from public.wholesale_offers offer
    where offer.id = wholesale_offer_tiers.offer_id
  )
);

grant select on public.wholesale_offers, public.wholesale_offer_tiers to authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.wholesale_offers, public.wholesale_offer_tiers
  from anon, authenticated;
grant all on public.wholesale_offers, public.wholesale_offer_tiers to service_role;

-- Strong invariant for all trusted writers, including future workers.
create or replace function public.guard_wholesale_offer_integrity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_product_seller uuid;
  v_variant_product uuid;
  v_tier_count integer;
begin
  select seller_id into v_product_seller
  from public.products
  where id = new.product_id;

  select product_id into v_variant_product
  from public.product_variants
  where id = new.variant_id;

  if v_product_seller is null
     or v_product_seller <> new.seller_id
     or v_variant_product is null
     or v_variant_product <> new.product_id then
    raise exception 'wholesale_offer_catalogue_mismatch' using errcode = '22023';
  end if;

  if new.status = 'active' then
    if not exists (
      select 1 from public.profiles_business b
      join public.profiles_seller s on s.id = b.id
      join public.products p on p.id = new.product_id
      join public.product_variants pv on pv.id = new.variant_id
      where b.id = new.seller_id
        and b.verification_status = 'verified'
        and s.verification_status = 'verified'
        and p.seller_id = new.seller_id
        and p.status = 'active'
        and p.moderation_status = 'approved'
        and pv.product_id = p.id
        and pv.is_active
    ) then
      raise exception 'wholesale_offer_requires_verified_active_catalogue' using errcode = '22023';
    end if;

    if not app_private.marketplace_capability_is_active(new.seller_id, 'seller')
       or not app_private.marketplace_capability_is_active(new.seller_id, 'business') then
      raise exception 'wholesale_seller_capability_suspended' using errcode = '42501';
    end if;

    select count(*)::integer into v_tier_count
    from public.wholesale_offer_tiers
    where offer_id = new.id;
    if v_tier_count < 1 then
      raise exception 'wholesale_offer_requires_pricing_tier' using errcode = '22023';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.guard_wholesale_offer_integrity() from public, anon, authenticated;
grant execute on function public.guard_wholesale_offer_integrity() to service_role;

drop trigger if exists trg_guard_wholesale_offer_integrity on public.wholesale_offers;
create trigger trg_guard_wholesale_offer_integrity
before insert or update on public.wholesale_offers
for each row execute function public.guard_wholesale_offer_integrity();

create or replace function public.business_save_wholesale_offer(
  p_offer_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_status text,
  p_minimum_order_quantity integer,
  p_order_multiple integer,
  p_unit_label text,
  p_case_pack_size integer,
  p_lead_time_days integer,
  p_incoterm text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_tiers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_offer_id uuid;
  v_status text := lower(btrim(coalesce(p_status, 'draft')));
  v_unit_label text := btrim(coalesce(p_unit_label, ''));
  v_incoterm text := nullif(upper(btrim(coalesce(p_incoterm, ''))), '');
  v_tier jsonb;
  v_minimum integer;
  v_price bigint;
  v_previous_minimum integer := 0;
  v_previous_price bigint := null;
  v_ordinality bigint;
  v_product record;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles_business where id = v_user_id) then
    raise exception 'business_profile_required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles_seller where id = v_user_id) then
    raise exception 'seller_profile_required' using errcode = '42501';
  end if;
  if not app_private.marketplace_capability_is_active(v_user_id, 'business')
     or not app_private.marketplace_capability_is_active(v_user_id, 'seller') then
    raise exception 'business_or_seller_capability_suspended' using errcode = '42501';
  end if;

  if v_status not in ('draft', 'active', 'paused', 'archived')
     or p_minimum_order_quantity is null
     or p_minimum_order_quantity < 1
     or p_minimum_order_quantity > 100000
     or p_order_multiple is null
     or p_order_multiple < 1
     or p_order_multiple > 100000
     or (p_minimum_order_quantity % p_order_multiple) <> 0
     or char_length(v_unit_label) < 1
     or char_length(v_unit_label) > 40
     or (p_case_pack_size is not null and (p_case_pack_size < 1 or p_case_pack_size > 100000))
     or p_lead_time_days is null
     or p_lead_time_days < 0
     or p_lead_time_days > 365
     or (v_incoterm is not null and v_incoterm not in ('EXW','FCA','CPT','CIP','DAP','DPU','DDP','FAS','FOB','CFR','CIF'))
     or (p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at) then
    raise exception 'invalid_wholesale_offer' using errcode = '22023';
  end if;

  if p_tiers is null
     or jsonb_typeof(p_tiers) <> 'array'
     or jsonb_array_length(p_tiers) < 1
     or jsonb_array_length(p_tiers) > 20 then
    raise exception 'invalid_wholesale_pricing_tiers' using errcode = '22023';
  end if;

  select p.id, p.seller_id, p.status, p.moderation_status,
         pv.id as variant_id, pv.is_active
    into v_product
  from public.products p
  join public.product_variants pv on pv.product_id = p.id
  where p.id = p_product_id
    and pv.id = p_variant_id
    and p.seller_id = v_user_id;

  if v_product.id is null then
    raise exception 'wholesale_offer_catalogue_not_owned' using errcode = '42501';
  end if;

  if p_offer_id is null then
    insert into public.wholesale_offers(
      seller_id, product_id, variant_id, status, minimum_order_quantity,
      order_multiple, unit_label, case_pack_size, lead_time_days, incoterm,
      starts_at, ends_at
    ) values (
      v_user_id, p_product_id, p_variant_id, 'draft', p_minimum_order_quantity,
      p_order_multiple, v_unit_label, p_case_pack_size, p_lead_time_days,
      v_incoterm, p_starts_at, p_ends_at
    ) returning id into v_offer_id;
  else
    update public.wholesale_offers
    set product_id = p_product_id,
        variant_id = p_variant_id,
        status = 'draft',
        minimum_order_quantity = p_minimum_order_quantity,
        order_multiple = p_order_multiple,
        unit_label = v_unit_label,
        case_pack_size = p_case_pack_size,
        lead_time_days = p_lead_time_days,
        incoterm = v_incoterm,
        starts_at = p_starts_at,
        ends_at = p_ends_at,
        updated_at = now()
    where id = p_offer_id
      and seller_id = v_user_id
    returning id into v_offer_id;

    if v_offer_id is null then
      raise exception 'wholesale_offer_not_found_or_access_denied' using errcode = '42501';
    end if;
  end if;

  delete from public.wholesale_offer_tiers where offer_id = v_offer_id;

  for v_tier, v_ordinality in
    select value, ordinality
    from jsonb_array_elements(p_tiers) with ordinality
  loop
    begin
      v_minimum := (v_tier->>'minimumQuantity')::integer;
      v_price := (v_tier->>'unitPriceCents')::bigint;
    exception when others then
      raise exception 'invalid_wholesale_pricing_tier' using errcode = '22023';
    end;

    if v_minimum < p_minimum_order_quantity
       or v_minimum > 100000
       or ((v_minimum - p_minimum_order_quantity) % p_order_multiple) <> 0
       or v_price < 1
       or v_price > 100000000000
       or v_minimum <= v_previous_minimum
       or (v_previous_price is not null and v_price > v_previous_price) then
      raise exception 'invalid_wholesale_pricing_tier' using errcode = '22023';
    end if;

    if v_ordinality = 1 and v_minimum <> p_minimum_order_quantity then
      raise exception 'first_wholesale_tier_must_equal_moq' using errcode = '22023';
    end if;

    insert into public.wholesale_offer_tiers(offer_id, minimum_quantity, unit_price_cents)
    values (v_offer_id, v_minimum, v_price);

    v_previous_minimum := v_minimum;
    v_previous_price := v_price;
  end loop;

  if v_status = 'active' then
    if v_product.status <> 'active'
       or v_product.moderation_status <> 'approved'
       or not v_product.is_active
       or not exists (
         select 1 from public.profiles_business b
         join public.profiles_seller s on s.id = b.id
         where b.id = v_user_id
           and b.verification_status = 'verified'
           and s.verification_status = 'verified'
       ) then
      raise exception 'wholesale_offer_activation_requires_verified_active_catalogue' using errcode = '22023';
    end if;
  end if;

  update public.wholesale_offers
  set status = v_status,
      updated_at = now()
  where id = v_offer_id;

  return v_offer_id;
end;
$$;

revoke all on function public.business_save_wholesale_offer(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamptz,timestamptz,jsonb)
  from public, anon;
grant execute on function public.business_save_wholesale_offer(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamptz,timestamptz,jsonb)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Canonical cart extension: retail and wholesale are explicit purchase modes.
-- ---------------------------------------------------------------------------
alter table public.cart_items
  drop constraint if exists cart_items_quantity_check;
alter table public.cart_items
  add constraint cart_items_quantity_check check (quantity between 1 and 100000);

alter table public.cart_items
  add column if not exists purchase_mode text not null default 'retail',
  add column if not exists wholesale_offer_id uuid;

alter table public.cart_items
  drop constraint if exists cart_items_purchase_mode_check;
alter table public.cart_items
  add constraint cart_items_purchase_mode_check
  check (purchase_mode in ('retail', 'wholesale'));

alter table public.cart_items
  drop constraint if exists cart_items_wholesale_offer_fkey;
alter table public.cart_items
  add constraint cart_items_wholesale_offer_fkey
  foreign key (wholesale_offer_id) references public.wholesale_offers(id) on delete restrict;

alter table public.cart_items
  drop constraint if exists cart_items_purchase_mode_offer_check;
alter table public.cart_items
  add constraint cart_items_purchase_mode_offer_check
  check (
    (purchase_mode = 'retail' and wholesale_offer_id is null)
    or (purchase_mode = 'wholesale' and wholesale_offer_id is not null)
  );

alter table public.cart_items
  drop constraint if exists cart_items_cart_variant_key;
alter table public.cart_items
  drop constraint if exists cart_items_cart_variant_mode_key;
alter table public.cart_items
  add constraint cart_items_cart_variant_mode_key
  unique(cart_id, variant_id, purchase_mode);

create index if not exists idx_cart_items_wholesale_offer
  on public.cart_items(wholesale_offer_id)
  where wholesale_offer_id is not null;

create or replace function public.guard_wholesale_cart_item_integrity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_buyer uuid;
  v_offer record;
begin
  if new.purchase_mode = 'retail' then
    if new.wholesale_offer_id is not null then
      raise exception 'retail_cart_item_cannot_reference_wholesale_offer' using errcode = '22023';
    end if;
    if new.quantity > 100 then
      raise exception 'retail_item_quantity_exceeds_limit' using errcode = '22023';
    end if;
    return new;
  end if;

  select buyer_id into v_buyer from public.carts where id = new.cart_id;
  if v_buyer is null then
    raise exception 'cart_not_found' using errcode = '22023';
  end if;

  select wo.id, wo.seller_id, wo.product_id, wo.variant_id, wo.status,
         wo.minimum_order_quantity, wo.order_multiple, wo.starts_at, wo.ends_at
    into v_offer
  from public.wholesale_offers wo
  where wo.id = new.wholesale_offer_id;

  if v_offer.id is null
     or v_offer.product_id <> new.product_id
     or v_offer.variant_id <> new.variant_id
     or v_offer.status <> 'active'
     or (v_offer.starts_at is not null and v_offer.starts_at > now())
     or (v_offer.ends_at is not null and v_offer.ends_at <= now())
     or new.quantity < v_offer.minimum_order_quantity
     or ((new.quantity - v_offer.minimum_order_quantity) % v_offer.order_multiple) <> 0 then
    raise exception 'invalid_wholesale_cart_item' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.profiles_business b
    where b.id = v_buyer and b.verification_status = 'verified'
  ) or not app_private.marketplace_capability_is_active(v_buyer, 'business') then
    raise exception 'verified_business_buyer_required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles_business b
    join public.profiles_seller s on s.id = b.id
    join public.products p on p.id = new.product_id
    join public.product_variants pv on pv.id = new.variant_id
    where b.id = v_offer.seller_id
      and b.verification_status = 'verified'
      and s.verification_status = 'verified'
      and p.seller_id = v_offer.seller_id
      and p.status = 'active'
      and p.moderation_status = 'approved'
      and pv.product_id = p.id
      and pv.is_active
  ) or not app_private.marketplace_capability_is_active(v_offer.seller_id, 'business')
    or not app_private.marketplace_capability_is_active(v_offer.seller_id, 'seller') then
    raise exception 'wholesale_seller_unavailable' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_wholesale_cart_item_integrity() from public, anon, authenticated;
grant execute on function public.guard_wholesale_cart_item_integrity() to service_role;

drop trigger if exists trg_guard_wholesale_cart_item_integrity on public.cart_items;
create trigger trg_guard_wholesale_cart_item_integrity
before insert or update on public.cart_items
for each row execute function public.guard_wholesale_cart_item_integrity();

-- Keep the canonical retail RPC behavior and limit while adapting its conflict
-- target to the new purchase-mode uniqueness contract.
create or replace function public.buyer_set_cart_item(
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
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

  v_cart_id := public.buyer_get_or_create_cart();

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

create or replace function public.buyer_set_wholesale_cart_item(
  p_offer_id uuid,
  p_quantity integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
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

  v_cart_id := public.buyer_get_or_create_cart();

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

revoke all on function public.buyer_set_wholesale_cart_item(uuid,integer) from public, anon;
grant execute on function public.buyer_set_wholesale_cart_item(uuid,integer)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Preserve wholesale authority on immutable order snapshots.
-- ---------------------------------------------------------------------------
alter table public.order_items
  add column if not exists purchase_mode text not null default 'retail',
  add column if not exists wholesale_offer_id uuid,
  add column if not exists pricing_snapshot jsonb not null default '{}'::jsonb;

alter table public.order_items
  drop constraint if exists order_items_purchase_mode_check;
alter table public.order_items
  add constraint order_items_purchase_mode_check
  check (purchase_mode in ('retail', 'wholesale'));

alter table public.order_items
  drop constraint if exists order_items_wholesale_offer_fkey;
alter table public.order_items
  add constraint order_items_wholesale_offer_fkey
  foreign key (wholesale_offer_id) references public.wholesale_offers(id) on delete set null;

alter table public.order_items
  drop constraint if exists order_items_purchase_mode_offer_check;
alter table public.order_items
  add constraint order_items_purchase_mode_offer_check
  check (
    (purchase_mode = 'retail' and wholesale_offer_id is null)
    or purchase_mode = 'wholesale'
  );

-- Replace the canonical freezer in place. Signature and browser privilege stay
-- unchanged; wholesale adds stronger final revalidation without a parallel
-- checkout/payment/order stack.
create or replace function public.create_checkout_session_v2(
  p_cart_id uuid,
  p_quote_id uuid,
  p_idempotency_key uuid
)
returns table(session_id uuid, amount_cents bigint)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_buyer_id uuid := auth.uid();
  v_cart public.carts%rowtype;
  v_quote public.cart_quotes%rowtype;
  v_session_id uuid;
  v_existing_status text;
  v_existing_metadata jsonb;
  v_item jsonb;
  v_product record;
  v_variant record;
  v_offer record;
  v_order_id uuid;
  v_qty integer;
  v_reserved integer;
  v_unit_price bigint;
  v_line_total bigint;
  v_snapshot_line bigint;
  v_snapshot_seller uuid;
  v_purchase_mode text;
  v_offer_id uuid;
  v_tier_minimum integer;
  v_pricing_snapshot jsonb;
  v_seller_entry record;
  v_seller_uuid uuid;
  v_seller_subtotal bigint;
  v_seller_tax bigint;
  v_seller_shipping bigint;
  v_seller_discount bigint;
  v_seller_total bigint;
  v_order_total_sum bigint;
begin
  if v_buyer_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_cart_id is null or p_quote_id is null or p_idempotency_key is null then
    raise exception 'cart_quote_and_idempotency_required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles_buyer where id = v_buyer_id) then
    raise exception 'buyer_profile_required' using errcode = '42501';
  end if;
  if not app_private.marketplace_capability_is_active(v_buyer_id, 'buyer') then
    raise exception 'buyer_capability_suspended' using errcode = '42501';
  end if;

  select ps.id, ps.amount_cents, ps.status, ps.metadata
    into v_session_id, amount_cents, v_existing_status, v_existing_metadata
  from public.payment_sessions ps
  where ps.buyer_id = v_buyer_id
    and ps.idempotency_key = p_idempotency_key
  for update;

  if v_session_id is not null then
    if v_existing_metadata->>'cart_id' is distinct from p_cart_id::text
       or v_existing_metadata->>'quote_id' is distinct from p_quote_id::text then
      raise exception 'idempotency_key_already_used_for_different_checkout'
        using errcode = '22023';
    end if;
    if v_existing_status in ('failed', 'cancelled') then
      raise exception 'checkout_session_no_longer_payable' using errcode = '22023';
    end if;
    if v_existing_status in ('pending', 'requires_payment')
       and exists (
         select 1 from public.inventory_reservations r
         where r.payment_session_id = v_session_id
           and r.status = 'pending'
           and r.expires_at <= now()
       ) then
      raise exception 'checkout_session_expired' using errcode = '22023';
    end if;
    return query select v_session_id, amount_cents;
    return;
  end if;

  select * into v_cart
  from public.carts
  where id = p_cart_id
    and buyer_id = v_buyer_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'active_cart_not_found_or_access_denied' using errcode = '42501';
  end if;

  select * into v_quote
  from public.cart_quotes
  where id = p_quote_id
    and cart_id = p_cart_id
    and buyer_id = v_buyer_id
  for update;

  if not found then
    raise exception 'cart_quote_not_found_or_access_denied' using errcode = '42501';
  end if;
  if v_quote.status <> 'ready' then
    raise exception 'cart_quote_not_ready' using errcode = '22023';
  end if;
  if v_quote.expires_at <= now() then
    update public.cart_quotes set status = 'expired' where id = p_quote_id;
    raise exception 'cart_quote_expired' using errcode = '22023';
  end if;
  if v_quote.cart_version <> v_cart.version then
    raise exception 'cart_quote_stale' using errcode = '22023';
  end if;
  if jsonb_array_length(v_quote.items_snapshot) < 1
     or jsonb_array_length(v_quote.items_snapshot) > 100 then
    raise exception 'invalid_cart_quote_items' using errcode = '22023';
  end if;

  insert into public.payment_sessions(
    buyer_id,
    idempotency_key,
    shipping_address,
    amount_cents,
    metadata
  ) values (
    v_buyer_id,
    p_idempotency_key,
    v_quote.shipping_address,
    v_quote.total_cents,
    jsonb_build_object(
      'cart_id', p_cart_id,
      'quote_id', p_quote_id,
      'cart_version', v_quote.cart_version,
      'items_snapshot', v_quote.items_snapshot,
      'seller_totals', v_quote.seller_totals,
      'quote_subtotal_cents', v_quote.subtotal_cents,
      'quote_tax_cents', v_quote.tax_cents,
      'quote_shipping_cents', v_quote.shipping_cents,
      'quote_discount_cents', v_quote.discount_cents,
      'marketplace_brand', 'entiznetstore'
    )
  )
  returning id into v_session_id;

  for v_item in select value from jsonb_array_elements(v_quote.items_snapshot) loop
    begin
      v_qty := (v_item->>'quantity')::integer;
      v_snapshot_seller := (v_item->>'sellerId')::uuid;
      v_snapshot_line := (v_item->>'lineTotalCents')::bigint;
      v_purchase_mode := coalesce(nullif(v_item->>'purchaseMode', ''), 'retail');
      v_offer_id := case
        when v_purchase_mode = 'wholesale' then (v_item->>'wholesaleOfferId')::uuid
        else null
      end;
    exception when others then
      raise exception 'invalid_cart_quote_item_snapshot' using errcode = '22023';
    end;

    if v_purchase_mode not in ('retail', 'wholesale')
       or (v_purchase_mode = 'retail' and (v_qty < 1 or v_qty > 100))
       or (v_purchase_mode = 'wholesale' and (v_qty < 1 or v_qty > 100000)) then
      raise exception 'invalid_item_quantity_or_purchase_mode' using errcode = '22023';
    end if;

    select p.id,
           p.seller_id,
           p.title,
           p.requires_shipping,
           p.is_taxable,
           p.marketplace_brand
      into v_product
    from public.products p
    join public.profiles_seller s on s.id = p.seller_id
    where p.id = (v_item->>'productId')::uuid
      and p.status = 'active'
      and p.moderation_status = 'approved'
      and s.verification_status = 'verified'
      and app_private.marketplace_capability_is_active(p.seller_id, 'seller');

    if v_product.id is null or v_product.seller_id <> v_snapshot_seller then
      raise exception 'quoted_product_unavailable_or_changed' using errcode = '22023';
    end if;
    if v_product.requires_shipping and v_quote.shipping_address is null then
      raise exception 'shipping_address_required' using errcode = '22023';
    end if;

    select pv.id,
           pv.title,
           pv.sku,
           pv.price,
           pv.inventory_quantity,
           pv.inventory_policy,
           pv.track_inventory
      into v_variant
    from public.product_variants pv
    where pv.id = (v_item->>'variantId')::uuid
      and pv.product_id = v_product.id
      and pv.is_active
    for update;

    if v_variant.id is null then
      raise exception 'quoted_variant_unavailable' using errcode = '22023';
    end if;

    if v_purchase_mode = 'wholesale' then
      if not exists (
        select 1 from public.profiles_business b
        where b.id = v_buyer_id and b.verification_status = 'verified'
      ) or not app_private.marketplace_capability_is_active(v_buyer_id, 'business') then
        raise exception 'verified_business_buyer_required' using errcode = '42501';
      end if;

      select wo.id, wo.minimum_order_quantity, wo.order_multiple,
             wo.unit_label, wo.case_pack_size, wo.lead_time_days, wo.incoterm,
             wo.starts_at, wo.ends_at
        into v_offer
      from public.wholesale_offers wo
      join public.profiles_business b on b.id = wo.seller_id
      where wo.id = v_offer_id
        and wo.seller_id = v_product.seller_id
        and wo.product_id = v_product.id
        and wo.variant_id = v_variant.id
        and wo.status = 'active'
        and (wo.starts_at is null or wo.starts_at <= now())
        and (wo.ends_at is null or wo.ends_at > now())
        and b.verification_status = 'verified'
        and app_private.marketplace_capability_is_active(wo.seller_id, 'business')
      for update of wo;

      if v_offer.id is null
         or v_qty < v_offer.minimum_order_quantity
         or ((v_qty - v_offer.minimum_order_quantity) % v_offer.order_multiple) <> 0 then
        raise exception 'wholesale_offer_unavailable_or_terms_changed' using errcode = '22023';
      end if;

      select tier.minimum_quantity, tier.unit_price_cents
        into v_tier_minimum, v_unit_price
      from public.wholesale_offer_tiers tier
      where tier.offer_id = v_offer.id
        and tier.minimum_quantity <= v_qty
      order by tier.minimum_quantity desc
      limit 1;

      if v_unit_price is null then
        raise exception 'wholesale_pricing_tier_unavailable' using errcode = '22023';
      end if;

      v_pricing_snapshot := jsonb_build_object(
        'offerId', v_offer.id,
        'tierMinimumQuantity', v_tier_minimum,
        'minimumOrderQuantity', v_offer.minimum_order_quantity,
        'orderMultiple', v_offer.order_multiple,
        'unitLabel', v_offer.unit_label,
        'casePackSize', v_offer.case_pack_size,
        'leadTimeDays', v_offer.lead_time_days,
        'incoterm', v_offer.incoterm,
        'unitPriceCents', v_unit_price
      );
    else
      v_unit_price := round(v_variant.price * 100)::bigint;
      v_tier_minimum := null;
      v_pricing_snapshot := jsonb_build_object(
        'source', 'retail_variant',
        'unitPriceCents', v_unit_price
      );
    end if;

    v_line_total := v_unit_price * v_qty;
    if v_unit_price <> (v_item->>'unitPriceCents')::bigint
       or v_line_total <> v_snapshot_line then
      raise exception 'cart_quote_price_changed' using errcode = '22023';
    end if;

    select coalesce(sum(r.quantity), 0)::integer
      into v_reserved
    from public.inventory_reservations r
    where r.variant_id = v_variant.id
      and r.status = 'pending'
      and r.expires_at > now();

    if v_variant.track_inventory
       and v_variant.inventory_policy = 'deny'
       and v_variant.inventory_quantity - v_reserved < v_qty then
      raise exception 'insufficient_inventory' using errcode = '22023';
    end if;

    select id into v_order_id
    from public.orders
    where payment_session_id = v_session_id
      and seller_id = v_product.seller_id;

    if v_order_id is null then
      insert into public.orders(
        order_number,
        buyer_id,
        seller_id,
        status,
        subtotal_cents,
        tax_cents,
        shipping_cents,
        discount_cents,
        total_cents,
        payment_status,
        fulfillment_status,
        shipping_address,
        payment_session_id,
        metadata
      ) values (
        'ENS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
        v_buyer_id,
        v_product.seller_id,
        'pending',
        0, 0, 0, 0, 0,
        'pending',
        'unfulfilled',
        v_quote.shipping_address,
        v_session_id,
        jsonb_build_object(
          'marketplace_brand', 'entiznetstore',
          'cart_id', p_cart_id,
          'quote_id', p_quote_id,
          'cart_version', v_quote.cart_version
        )
      ) returning id into v_order_id;
    end if;

    insert into public.order_items(
      order_id,
      product_id,
      variant_id,
      quantity,
      price_cents,
      total_cents,
      product_title,
      variant_title,
      sku,
      requires_shipping,
      is_digital,
      purchase_mode,
      wholesale_offer_id,
      pricing_snapshot
    ) values (
      v_order_id,
      v_product.id,
      v_variant.id,
      v_qty,
      v_unit_price,
      v_line_total,
      coalesce(nullif(v_item->>'title', ''), v_product.title),
      nullif(v_item->>'variantTitle', ''),
      nullif(v_item->>'sku', ''),
      v_product.requires_shipping,
      not v_product.requires_shipping,
      v_purchase_mode,
      v_offer_id,
      v_pricing_snapshot
    );

    update public.orders
    set subtotal_cents = subtotal_cents + v_line_total,
        total_cents = total_cents + v_line_total,
        updated_at = now()
    where id = v_order_id;

    insert into public.inventory_reservations(
      payment_session_id,
      product_id,
      variant_id,
      quantity
    ) values (v_session_id, v_product.id, v_variant.id, v_qty);
  end loop;

  for v_seller_entry in select key, value from jsonb_each(v_quote.seller_totals) loop
    begin
      v_seller_uuid := v_seller_entry.key::uuid;
      v_seller_subtotal := coalesce((v_seller_entry.value->>'subtotalCents')::bigint, 0);
      v_seller_tax := coalesce((v_seller_entry.value->>'taxCents')::bigint, 0);
      v_seller_shipping := coalesce((v_seller_entry.value->>'shippingCents')::bigint, 0);
      v_seller_discount := coalesce((v_seller_entry.value->>'discountCents')::bigint, 0);
      v_seller_total := coalesce((v_seller_entry.value->>'totalCents')::bigint, 0);
    exception when others then
      raise exception 'invalid_seller_total_snapshot' using errcode = '22023';
    end;

    if v_seller_total <> v_seller_subtotal + v_seller_tax + v_seller_shipping - v_seller_discount
       or v_seller_subtotal < 0 or v_seller_tax < 0 or v_seller_shipping < 0
       or v_seller_discount < 0 or v_seller_total < 0 then
      raise exception 'invalid_seller_total_math' using errcode = '22023';
    end if;

    update public.orders
    set tax_cents = v_seller_tax,
        shipping_cents = v_seller_shipping,
        discount_cents = v_seller_discount,
        total_cents = v_seller_total,
        updated_at = now()
    where payment_session_id = v_session_id
      and seller_id = v_seller_uuid
      and subtotal_cents = v_seller_subtotal;

    if not found then
      raise exception 'seller_total_does_not_match_checkout_items' using errcode = '22023';
    end if;
  end loop;

  if exists (
    select 1 from public.orders o
    where o.payment_session_id = v_session_id
      and not (v_quote.seller_totals ? o.seller_id::text)
  ) then
    raise exception 'missing_seller_total_snapshot' using errcode = '22023';
  end if;

  select coalesce(sum(o.total_cents), 0)::bigint into v_order_total_sum
  from public.orders o where o.payment_session_id = v_session_id;

  if v_order_total_sum <> v_quote.total_cents then
    raise exception 'quote_order_total_mismatch' using errcode = '22023';
  end if;

  update public.cart_quotes
  set status = 'consumed', consumed_at = now()
  where id = p_quote_id and status = 'ready';

  if not found then
    raise exception 'cart_quote_already_consumed';
  end if;

  return query select v_session_id, v_quote.total_cents;
end;
$$;

-- Signature remains the same, but reassert least-privilege grants explicitly.
revoke all on function public.create_checkout_session_v2(uuid,uuid,uuid)
  from public, anon;
grant execute on function public.create_checkout_session_v2(uuid,uuid,uuid)
  to authenticated, service_role;

commit;
