-- EntizNetStore M3 — persistent Buyer cart and address foundation.
-- Browser roles may read their own cart/address state but all mutation is
-- authenticated RPC-only so product ownership, publication and inventory rules
-- cannot be bypassed through direct PostgREST writes.

begin;

-- ---------------------------------------------------------------------------
-- Buyer-owned addresses
-- ---------------------------------------------------------------------------
update public.addresses
set user_id = null
where false; -- explicit no-op: live preflight confirmed there are no legacy rows.

alter table public.addresses
  alter column user_id set not null;

create unique index if not exists addresses_one_default_per_user_type
  on public.addresses(user_id, type)
  where is_default;

create index if not exists idx_addresses_user_created
  on public.addresses(user_id, created_at desc);

alter table public.addresses enable row level security;

drop policy if exists addresses_buyer_select_own on public.addresses;
create policy addresses_buyer_select_own
on public.addresses
for select to authenticated
using (user_id = (select auth.uid()));

grant select on public.addresses to authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.addresses from anon, authenticated;
grant all on public.addresses to service_role;

create or replace function public.buyer_save_address(
  p_address_id uuid,
  p_nickname text,
  p_is_default boolean,
  p_type text,
  p_first_name text,
  p_last_name text,
  p_company text,
  p_address_line1 text,
  p_address_line2 text,
  p_city text,
  p_state_province text,
  p_postal_code text,
  p_country text,
  p_phone text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_address_id uuid;
  v_type text := lower(btrim(coalesce(p_type, 'shipping')));
  v_country text := upper(btrim(coalesce(p_country, '')));
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles_buyer where id = v_user_id) then
    raise exception 'buyer_profile_required' using errcode = '42501';
  end if;
  if v_type not in ('shipping', 'billing', 'both') then
    raise exception 'invalid_address_type' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_first_name, '')), '') is null
     or length(btrim(p_first_name)) > 100
     or nullif(btrim(coalesce(p_last_name, '')), '') is null
     or length(btrim(p_last_name)) > 100
     or nullif(btrim(coalesce(p_address_line1, '')), '') is null
     or length(btrim(p_address_line1)) > 200
     or nullif(btrim(coalesce(p_city, '')), '') is null
     or length(btrim(p_city)) > 100
     or nullif(btrim(coalesce(p_postal_code, '')), '') is null
     or length(btrim(p_postal_code)) > 30
     or v_country !~ '^[A-Z]{2}$' then
    raise exception 'invalid_address' using errcode = '22023';
  end if;
  if length(coalesce(p_nickname, '')) > 100
     or length(coalesce(p_company, '')) > 150
     or length(coalesce(p_address_line2, '')) > 200
     or length(coalesce(p_state_province, '')) > 100
     or length(coalesce(p_phone, '')) > 40 then
    raise exception 'invalid_address' using errcode = '22023';
  end if;

  if coalesce(p_is_default, false) then
    update public.addresses
    set is_default = false,
        updated_at = now()
    where user_id = v_user_id
      and is_default
      and type = v_type
      and (p_address_id is null or id <> p_address_id);
  end if;

  if p_address_id is null then
    insert into public.addresses(
      user_id, nickname, is_default, type, first_name, last_name, company,
      address_line1, address_line2, city, state_province, postal_code,
      country, phone
    ) values (
      v_user_id,
      nullif(btrim(coalesce(p_nickname, '')), ''),
      coalesce(p_is_default, false),
      v_type,
      btrim(p_first_name),
      btrim(p_last_name),
      nullif(btrim(coalesce(p_company, '')), ''),
      btrim(p_address_line1),
      nullif(btrim(coalesce(p_address_line2, '')), ''),
      btrim(p_city),
      nullif(btrim(coalesce(p_state_province, '')), ''),
      btrim(p_postal_code),
      v_country,
      nullif(btrim(coalesce(p_phone, '')), '')
    ) returning id into v_address_id;
  else
    update public.addresses
    set nickname = nullif(btrim(coalesce(p_nickname, '')), ''),
        is_default = coalesce(p_is_default, false),
        type = v_type,
        first_name = btrim(p_first_name),
        last_name = btrim(p_last_name),
        company = nullif(btrim(coalesce(p_company, '')), ''),
        address_line1 = btrim(p_address_line1),
        address_line2 = nullif(btrim(coalesce(p_address_line2, '')), ''),
        city = btrim(p_city),
        state_province = nullif(btrim(coalesce(p_state_province, '')), ''),
        postal_code = btrim(p_postal_code),
        country = v_country,
        phone = nullif(btrim(coalesce(p_phone, '')), ''),
        updated_at = now()
    where id = p_address_id and user_id = v_user_id
    returning id into v_address_id;

    if v_address_id is null then
      raise exception 'address_not_found_or_access_denied' using errcode = '42501';
    end if;
  end if;

  return v_address_id;
end;
$$;

create or replace function public.buyer_delete_address(p_address_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  delete from public.addresses
  where id = p_address_id and user_id = v_user_id;

  if not found then
    raise exception 'address_not_found_or_access_denied' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.buyer_save_address(uuid,text,boolean,text,text,text,text,text,text,text,text,text,text,text)
  from public, anon;
grant execute on function public.buyer_save_address(uuid,text,boolean,text,text,text,text,text,text,text,text,text,text,text)
  to authenticated, service_role;
revoke all on function public.buyer_delete_address(uuid) from public, anon;
grant execute on function public.buyer_delete_address(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Persistent cart
-- ---------------------------------------------------------------------------
create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles_buyer(id) on delete cascade,
  status text not null default 'active'
    constraint carts_status_check check (status in ('active', 'converted', 'abandoned')),
  currency text not null default 'usd'
    constraint carts_currency_check check (currency = 'usd'),
  version bigint not null default 1
    constraint carts_version_check check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists carts_one_active_per_buyer
  on public.carts(buyer_id)
  where status = 'active';
create index if not exists idx_carts_buyer_updated
  on public.carts(buyer_id, updated_at desc);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity integer not null
    constraint cart_items_quantity_check check (quantity between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_items_cart_variant_key unique(cart_id, variant_id)
);

create index if not exists idx_cart_items_cart
  on public.cart_items(cart_id, created_at);
create index if not exists idx_cart_items_variant
  on public.cart_items(variant_id);

-- Quote rows are immutable snapshots. A quote is valid only while cart.version
-- still equals cart_version and expires_at is in the future.
create table if not exists public.cart_quotes (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete restrict,
  buyer_id uuid not null references public.profiles_buyer(id) on delete restrict,
  cart_version bigint not null,
  status text not null
    constraint cart_quotes_status_check
    check (status in ('ready', 'blocked', 'expired', 'consumed')),
  block_reasons text[] not null default '{}'::text[],
  currency text not null default 'usd'
    constraint cart_quotes_currency_check check (currency = 'usd'),
  subtotal_cents bigint not null constraint cart_quotes_subtotal_check check (subtotal_cents >= 0),
  tax_cents bigint not null default 0 constraint cart_quotes_tax_check check (tax_cents >= 0),
  shipping_cents bigint not null default 0 constraint cart_quotes_shipping_check check (shipping_cents >= 0),
  discount_cents bigint not null default 0 constraint cart_quotes_discount_check check (discount_cents >= 0),
  total_cents bigint not null constraint cart_quotes_total_check check (total_cents >= 0),
  shipping_address jsonb,
  shipping_quote jsonb,
  tax_quote jsonb,
  items_snapshot jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint cart_quotes_total_math_check
    check (total_cents = subtotal_cents + tax_cents + shipping_cents - discount_cents)
);

create index if not exists idx_cart_quotes_cart_created
  on public.cart_quotes(cart_id, created_at desc);
create index if not exists idx_cart_quotes_buyer_created
  on public.cart_quotes(buyer_id, created_at desc);
create index if not exists idx_cart_quotes_expiry
  on public.cart_quotes(expires_at)
  where status = 'ready';

alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.cart_quotes enable row level security;

drop policy if exists carts_buyer_select_own on public.carts;
create policy carts_buyer_select_own
on public.carts for select to authenticated
using (buyer_id = (select auth.uid()));

drop policy if exists cart_items_buyer_select_own on public.cart_items;
create policy cart_items_buyer_select_own
on public.cart_items for select to authenticated
using (exists (
  select 1 from public.carts c
  where c.id = cart_items.cart_id
    and c.buyer_id = (select auth.uid())
));

drop policy if exists cart_quotes_buyer_select_own on public.cart_quotes;
create policy cart_quotes_buyer_select_own
on public.cart_quotes for select to authenticated
using (buyer_id = (select auth.uid()));

grant select on public.carts, public.cart_items, public.cart_quotes to authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.carts, public.cart_items, public.cart_quotes
  from anon, authenticated;
grant all on public.carts, public.cart_items, public.cart_quotes to service_role;

-- ---------------------------------------------------------------------------
-- Cart mutation RPCs
-- ---------------------------------------------------------------------------
create or replace function public.buyer_get_or_create_cart()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
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

create or replace function public.buyer_set_cart_item(
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
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

  insert into public.cart_items(cart_id, product_id, variant_id, quantity)
  values (v_cart_id, p_product_id, p_variant_id, p_quantity)
  on conflict (cart_id, variant_id)
  do update set product_id = excluded.product_id,
                quantity = excluded.quantity,
                updated_at = now()
  returning id into v_item_id;

  update public.carts
  set version = version + 1,
      updated_at = now()
  where id = v_cart_id and buyer_id = v_user_id and status = 'active';

  return v_item_id;
end;
$$;

create or replace function public.buyer_remove_cart_item(p_cart_item_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
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

create or replace function public.buyer_clear_cart()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
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

revoke all on function public.buyer_get_or_create_cart() from public, anon;
grant execute on function public.buyer_get_or_create_cart() to authenticated, service_role;
revoke all on function public.buyer_set_cart_item(uuid,uuid,integer) from public, anon;
grant execute on function public.buyer_set_cart_item(uuid,uuid,integer) to authenticated, service_role;
revoke all on function public.buyer_remove_cart_item(uuid) from public, anon;
grant execute on function public.buyer_remove_cart_item(uuid) to authenticated, service_role;
revoke all on function public.buyer_clear_cart() from public, anon;
grant execute on function public.buyer_clear_cart() to authenticated, service_role;

commit;
