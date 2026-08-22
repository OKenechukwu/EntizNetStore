-- EntizNetStore M2 — catalogue, storefront and product-moderation foundation.
-- Forward-only migration. Seller catalogue writes move behind audited RPCs so
-- a verified seller cannot self-publish or bypass product review through the
-- exposed PostgREST tables.

begin;

-- ---------------------------------------------------------------------------
-- Stable public storefront identity
-- ---------------------------------------------------------------------------
alter table public.profiles_seller
  add column if not exists store_slug text;

create or replace function public.ensure_seller_store_slug()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_base text;
begin
  if nullif(btrim(new.store_slug), '') is null then
    v_base := btrim(regexp_replace(lower(btrim(coalesce(new.storefront_name, 'store'))), '[^a-z0-9]+', '-', 'g'), '-');
    if v_base = '' then v_base := 'store'; end if;
    new.store_slug := v_base || '-' || substr(replace(new.id::text, '-', ''), 1, 12);
  else
    new.store_slug := lower(btrim(new.store_slug));
    if new.store_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
      raise exception 'invalid_store_slug' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

update public.profiles_seller
set store_slug = btrim(regexp_replace(lower(btrim(storefront_name)), '[^a-z0-9]+', '-', 'g'), '-')
  || '-' || substr(replace(id::text, '-', ''), 1, 12)
where store_slug is null or btrim(store_slug) = '';

alter table public.profiles_seller
  alter column store_slug set not null;

create unique index if not exists profiles_seller_store_slug_key
  on public.profiles_seller(store_slug);

drop trigger if exists trg_profiles_seller_store_slug on public.profiles_seller;
create trigger trg_profiles_seller_store_slug
before insert on public.profiles_seller
for each row execute function public.ensure_seller_store_slug();

revoke all on function public.ensure_seller_store_slug() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Product moderation state and immutable ownership
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists moderation_status text not null default 'not_submitted',
  add column if not exists moderation_notes text,
  add column if not exists submitted_for_review_at timestamptz,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid references auth.users(id) on delete set null;

alter table public.products
  drop constraint if exists products_moderation_status_check;
alter table public.products
  add constraint products_moderation_status_check
  check (moderation_status in ('not_submitted', 'pending', 'approved', 'rejected'));

-- Safety first: an existing active listing must be re-reviewed under M2.
update public.products
set status = 'draft',
    moderation_status = 'not_submitted',
    moderation_notes = null,
    submitted_for_review_at = null,
    moderated_at = null,
    moderated_by = null
where status = 'active';

-- Canonical catalogue ownership can no longer become orphaned.
alter table public.products drop constraint if exists products_seller_id_fkey;
alter table public.products alter column seller_id set not null;
alter table public.products
  add constraint products_seller_id_fkey
  foreign key (seller_id) references public.profiles_seller(id) on delete restrict;

create index if not exists idx_products_moderation_status
  on public.products(moderation_status, status, created_at desc);

-- Product review history is separate from mutable product state.
create table if not exists public.product_moderation_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text not null
    constraint product_moderation_events_actor_role_check
    check (actor_role in ('seller', 'admin', 'system')),
  action text not null
    constraint product_moderation_events_action_check
    check (action in ('edited', 'submitted', 'approved', 'rejected', 'published', 'unpublished')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.product_moderation_events enable row level security;
create index if not exists idx_product_moderation_events_product_created
  on public.product_moderation_events(product_id, created_at desc);

revoke all on table public.product_moderation_events from public, anon, authenticated;
grant select on table public.product_moderation_events to authenticated;
grant all on table public.product_moderation_events to service_role;

drop policy if exists product_moderation_events_seller_select on public.product_moderation_events;
create policy product_moderation_events_seller_select
on public.product_moderation_events
for select to authenticated
using (
  exists (
    select 1 from public.products p
    where p.id = product_moderation_events.product_id
      and p.seller_id = (select auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- Public/owner catalogue visibility follows moderation + Seller verification.
-- All direct Seller mutation policies are removed; writes use RPCs below.
-- ---------------------------------------------------------------------------
drop policy if exists products_public_select on public.products;
drop policy if exists products_seller_select_own on public.products;
drop policy if exists products_anon_select on public.products;
drop policy if exists products_authenticated_select on public.products;
drop policy if exists products_seller_insert_own on public.products;
drop policy if exists products_seller_update_own on public.products;
drop policy if exists products_seller_delete_own on public.products;

create policy products_anon_select on public.products
for select to anon
using (
  status = 'active'
  and moderation_status = 'approved'
  and exists (
    select 1 from public.profiles_seller s
    where s.id = products.seller_id
      and s.verification_status = 'verified'
  )
);

create policy products_authenticated_select on public.products
for select to authenticated
using (
  seller_id = (select auth.uid())
  or (
    status = 'active'
    and moderation_status = 'approved'
    and exists (
      select 1 from public.profiles_seller s
      where s.id = products.seller_id
        and s.verification_status = 'verified'
    )
  )
);

-- Child rows inherit the same parent visibility. Seller ownership remains
-- readable for dashboard/editor hydration but mutations are RPC-only.
drop policy if exists product_variants_public_select on public.product_variants;
drop policy if exists product_variants_seller_all on public.product_variants;
drop policy if exists product_variants_anon_select on public.product_variants;
drop policy if exists product_variants_authenticated_select on public.product_variants;
drop policy if exists product_variants_seller_insert on public.product_variants;
drop policy if exists product_variants_seller_update on public.product_variants;
drop policy if exists product_variants_seller_delete on public.product_variants;

create policy product_variants_anon_select on public.product_variants
for select to anon
using (exists (
  select 1 from public.products p
  join public.profiles_seller s on s.id = p.seller_id
  where p.id = product_variants.product_id
    and p.status = 'active'
    and p.moderation_status = 'approved'
    and s.verification_status = 'verified'
));

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
        and exists (
          select 1 from public.profiles_seller s
          where s.id = p.seller_id and s.verification_status = 'verified'
        )
      )
    )
));

drop policy if exists product_media_public_select on public.product_media;
drop policy if exists product_media_seller_all on public.product_media;
drop policy if exists product_media_anon_select on public.product_media;
drop policy if exists product_media_authenticated_select on public.product_media;
drop policy if exists product_media_seller_insert on public.product_media;
drop policy if exists product_media_seller_update on public.product_media;
drop policy if exists product_media_seller_delete on public.product_media;

create policy product_media_anon_select on public.product_media
for select to anon
using (exists (
  select 1 from public.products p
  join public.profiles_seller s on s.id = p.seller_id
  where p.id = product_media.product_id
    and p.status = 'active'
    and p.moderation_status = 'approved'
    and s.verification_status = 'verified'
));

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
        and exists (
          select 1 from public.profiles_seller s
          where s.id = p.seller_id and s.verification_status = 'verified'
        )
      )
    )
));

drop policy if exists product_categories_public_select on public.product_categories;
drop policy if exists product_categories_seller_all on public.product_categories;
drop policy if exists product_categories_anon_select on public.product_categories;
drop policy if exists product_categories_authenticated_select on public.product_categories;
drop policy if exists product_categories_seller_insert on public.product_categories;
drop policy if exists product_categories_seller_update on public.product_categories;
drop policy if exists product_categories_seller_delete on public.product_categories;

create policy product_categories_anon_select on public.product_categories
for select to anon
using (exists (
  select 1 from public.products p
  join public.profiles_seller s on s.id = p.seller_id
  where p.id = product_categories.product_id
    and p.status = 'active'
    and p.moderation_status = 'approved'
    and s.verification_status = 'verified'
));

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
        and exists (
          select 1 from public.profiles_seller s
          where s.id = p.seller_id and s.verification_status = 'verified'
        )
      )
    )
));

-- Keep browser reads, remove browser table mutations. SECURITY DEFINER RPCs own
-- Seller writes and perform explicit auth.uid()/ownership checks.
grant select on public.products, public.product_variants, public.product_media, public.product_categories
  to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.products, public.product_variants, public.product_media, public.product_categories
  from anon, authenticated;
grant all on public.products, public.product_variants, public.product_media, public.product_categories
  to service_role;

-- ---------------------------------------------------------------------------
-- Canonical M2 Seller save: every create/edit is a draft and invalidates prior
-- product approval. Rich catalogue fields and multi-variant inventory persist
-- atomically. Media URLs are pre-validated by the trusted application server.
-- ---------------------------------------------------------------------------
create or replace function public.seller_save_product_v3(
  p_product_id uuid,
  p_title text,
  p_description text,
  p_short_description text,
  p_product_type text,
  p_base_price numeric,
  p_compare_at_price numeric,
  p_cost_per_item numeric,
  p_brand_id uuid,
  p_category_ids uuid[],
  p_media_urls text[],
  p_variants jsonb,
  p_track_inventory boolean,
  p_continue_selling boolean,
  p_requires_shipping boolean,
  p_is_taxable boolean,
  p_weight_grams integer,
  p_material text,
  p_age_restriction integer,
  p_tags text[],
  p_search_keywords text[]
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_product_id uuid;
  v_verification_status text;
  v_previous_moderation text := 'not_submitted';
  v_slug text;
  v_url text;
  v_category_id uuid;
  v_variant jsonb;
  v_variant_id uuid;
  v_variant_ids uuid[] := '{}'::uuid[];
  v_position integer := 0;
  v_variant_price numeric;
  v_variant_compare numeric;
  v_variant_cost numeric;
  v_inventory integer;
  v_inventory_policy text;
  v_variant_track boolean;
  v_variant_shipping boolean;
  v_variant_active boolean;
  v_variant_weight integer;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select verification_status into v_verification_status
  from public.profiles_seller where id = v_user_id;
  if v_verification_status is null then
    raise exception 'seller_profile_required' using errcode = '42501';
  end if;
  if v_verification_status = 'suspended' then
    raise exception 'seller_suspended' using errcode = '42501';
  end if;

  if nullif(btrim(p_title), '') is null or length(btrim(p_title)) > 200 then
    raise exception 'invalid_product_title' using errcode = '22023';
  end if;
  if length(coalesce(p_description, '')) > 10000 or length(coalesce(p_short_description, '')) > 500 then
    raise exception 'invalid_product_description' using errcode = '22023';
  end if;
  if p_product_type not in ('physical', 'digital') then
    raise exception 'invalid_product_type' using errcode = '22023';
  end if;
  if p_base_price is null or p_base_price <= 0 or p_base_price > 1000000 then
    raise exception 'invalid_base_price' using errcode = '22023';
  end if;
  if p_compare_at_price is not null and p_compare_at_price <= p_base_price then
    raise exception 'invalid_compare_at_price' using errcode = '22023';
  end if;
  if p_cost_per_item is not null and p_cost_per_item < 0 then
    raise exception 'invalid_cost_per_item' using errcode = '22023';
  end if;
  if p_weight_grams is not null and p_weight_grams < 0 then
    raise exception 'invalid_weight' using errcode = '22023';
  end if;
  if coalesce(p_age_restriction, 18) < 18 or coalesce(p_age_restriction, 18) > 99 then
    raise exception 'invalid_age_restriction' using errcode = '22023';
  end if;
  if p_brand_id is not null and not exists (select 1 from public.brands where id = p_brand_id) then
    raise exception 'brand_not_found' using errcode = '22023';
  end if;
  if p_variants is null or jsonb_typeof(p_variants) <> 'array'
     or jsonb_array_length(p_variants) < 1 or jsonb_array_length(p_variants) > 100 then
    raise exception 'invalid_variants' using errcode = '22023';
  end if;
  if cardinality(coalesce(p_category_ids, '{}'::uuid[])) > 10 then
    raise exception 'too_many_categories' using errcode = '22023';
  end if;
  if cardinality(coalesce(p_media_urls, '{}'::text[])) > 10 then
    raise exception 'too_many_media_items' using errcode = '22023';
  end if;

  if p_product_id is null then
    v_slug := btrim(regexp_replace(lower(btrim(p_title)), '[^a-z0-9]+', '-', 'g'), '-')
      || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
    insert into public.products (
      seller_id, brand_id, title, slug, description, short_description, type,
      status, moderation_status, base_price, compare_at_price, cost_per_item,
      track_inventory, continue_selling, requires_shipping, is_taxable,
      weight_grams, material, age_restriction, tags, search_keywords,
      marketplace_brand
    ) values (
      v_user_id, p_brand_id, btrim(p_title), v_slug,
      nullif(btrim(coalesce(p_description, '')), ''),
      nullif(btrim(coalesce(p_short_description, '')), ''),
      p_product_type, 'draft', 'not_submitted', p_base_price, p_compare_at_price,
      p_cost_per_item, coalesce(p_track_inventory, true),
      coalesce(p_continue_selling, false), coalesce(p_requires_shipping, true),
      coalesce(p_is_taxable, true), p_weight_grams,
      nullif(btrim(coalesce(p_material, '')), ''), coalesce(p_age_restriction, 18),
      coalesce(p_tags, '{}'::text[]), coalesce(p_search_keywords, '{}'::text[]),
      'entiznetstore'
    ) returning id into v_product_id;
  else
    select moderation_status into v_previous_moderation
    from public.products
    where id = p_product_id and seller_id = v_user_id
    for update;
    if not found then
      raise exception 'product_not_found_or_access_denied' using errcode = '42501';
    end if;

    update public.products
    set brand_id = p_brand_id,
        title = btrim(p_title),
        description = nullif(btrim(coalesce(p_description, '')), ''),
        short_description = nullif(btrim(coalesce(p_short_description, '')), ''),
        type = p_product_type,
        status = 'draft',
        moderation_status = 'not_submitted',
        moderation_notes = null,
        submitted_for_review_at = null,
        moderated_at = null,
        moderated_by = null,
        base_price = p_base_price,
        compare_at_price = p_compare_at_price,
        cost_per_item = p_cost_per_item,
        track_inventory = coalesce(p_track_inventory, true),
        continue_selling = coalesce(p_continue_selling, false),
        requires_shipping = coalesce(p_requires_shipping, true),
        is_taxable = coalesce(p_is_taxable, true),
        weight_grams = p_weight_grams,
        material = nullif(btrim(coalesce(p_material, '')), ''),
        age_restriction = coalesce(p_age_restriction, 18),
        tags = coalesce(p_tags, '{}'::text[]),
        search_keywords = coalesce(p_search_keywords, '{}'::text[]),
        marketplace_brand = 'entiznetstore',
        updated_at = now()
    where id = v_product_id or id = p_product_id;
    v_product_id := p_product_id;

    delete from public.product_categories where product_id = v_product_id;
    delete from public.product_media where product_id = v_product_id;

    insert into public.product_moderation_events(product_id, actor_id, actor_role, action, metadata)
    values (
      v_product_id, v_user_id, 'seller', 'edited',
      jsonb_build_object('previous_moderation_status', v_previous_moderation)
    );
  end if;

  foreach v_category_id in array coalesce(p_category_ids, '{}'::uuid[]) loop
    insert into public.product_categories(product_id, category_id)
    select v_product_id, id from public.categories
    where id = v_category_id and is_active
    on conflict do nothing;
  end loop;

  foreach v_url in array coalesce(p_media_urls, '{}'::text[]) loop
    if nullif(btrim(v_url), '') is not null then
      if btrim(v_url) !~ '^https://' then
        raise exception 'product_media_must_use_https' using errcode = '22023';
      end if;
      insert into public.product_media(product_id, type, url, position)
      values (
        v_product_id, 'image', btrim(v_url),
        (select count(*) from public.product_media where product_id = v_product_id)
      );
    end if;
  end loop;

  for v_variant in select value from jsonb_array_elements(p_variants) loop
    if nullif(btrim(v_variant->>'title'), '') is null then
      raise exception 'variant_title_required' using errcode = '22023';
    end if;
    v_variant_price := nullif(v_variant->>'price', '')::numeric;
    v_variant_compare := nullif(v_variant->>'compareAtPrice', '')::numeric;
    v_variant_cost := nullif(v_variant->>'costPerItem', '')::numeric;
    v_inventory := coalesce(nullif(v_variant->>'inventoryQuantity', '')::integer, 0);
    v_inventory_policy := coalesce(nullif(v_variant->>'inventoryPolicy', ''), 'deny');
    v_variant_track := coalesce(nullif(v_variant->>'trackInventory', '')::boolean, true);
    v_variant_shipping := coalesce(nullif(v_variant->>'requiresShipping', '')::boolean, coalesce(p_requires_shipping, true));
    v_variant_active := coalesce(nullif(v_variant->>'isActive', '')::boolean, true);
    v_variant_weight := nullif(v_variant->>'weightGrams', '')::integer;

    if v_variant_price is null or v_variant_price <= 0 or v_variant_price > 1000000 then
      raise exception 'invalid_variant_price' using errcode = '22023';
    end if;
    if v_variant_compare is not null and v_variant_compare <= v_variant_price then
      raise exception 'invalid_variant_compare_at_price' using errcode = '22023';
    end if;
    if v_variant_cost is not null and v_variant_cost < 0 then
      raise exception 'invalid_variant_cost' using errcode = '22023';
    end if;
    if v_inventory < 0 or v_inventory > 100000000 then
      raise exception 'invalid_variant_inventory' using errcode = '22023';
    end if;
    if v_inventory_policy not in ('deny', 'continue') then
      raise exception 'invalid_inventory_policy' using errcode = '22023';
    end if;
    if v_variant_weight is not null and v_variant_weight < 0 then
      raise exception 'invalid_variant_weight' using errcode = '22023';
    end if;

    v_variant_id := null;
    if nullif(v_variant->>'id', '') is not null then
      update public.product_variants
      set title = btrim(v_variant->>'title'),
          option1 = nullif(btrim(coalesce(v_variant->>'option1', '')), ''),
          option2 = nullif(btrim(coalesce(v_variant->>'option2', '')), ''),
          option3 = nullif(btrim(coalesce(v_variant->>'option3', '')), ''),
          sku = nullif(btrim(coalesce(v_variant->>'sku', '')), ''),
          barcode = nullif(btrim(coalesce(v_variant->>'barcode', '')), ''),
          price = v_variant_price,
          compare_at_price = v_variant_compare,
          cost_per_item = v_variant_cost,
          track_inventory = v_variant_track,
          inventory_quantity = v_inventory,
          inventory_policy = v_inventory_policy,
          weight_grams = v_variant_weight,
          requires_shipping = v_variant_shipping,
          is_active = v_variant_active,
          position = v_position,
          updated_at = now()
      where id = (v_variant->>'id')::uuid and product_id = v_product_id
      returning id into v_variant_id;
      if v_variant_id is null then
        raise exception 'variant_not_found_or_access_denied' using errcode = '42501';
      end if;
    else
      insert into public.product_variants(
        product_id, title, option1, option2, option3, sku, barcode, price,
        compare_at_price, cost_per_item, track_inventory, inventory_quantity,
        inventory_policy, weight_grams, requires_shipping, is_active, position
      ) values (
        v_product_id, btrim(v_variant->>'title'),
        nullif(btrim(coalesce(v_variant->>'option1', '')), ''),
        nullif(btrim(coalesce(v_variant->>'option2', '')), ''),
        nullif(btrim(coalesce(v_variant->>'option3', '')), ''),
        nullif(btrim(coalesce(v_variant->>'sku', '')), ''),
        nullif(btrim(coalesce(v_variant->>'barcode', '')), ''),
        v_variant_price, v_variant_compare, v_variant_cost, v_variant_track,
        v_inventory, v_inventory_policy, v_variant_weight, v_variant_shipping,
        v_variant_active, v_position
      ) returning id into v_variant_id;
    end if;
    v_variant_ids := array_append(v_variant_ids, v_variant_id);
    v_position := v_position + 1;
  end loop;

  update public.product_variants
  set is_active = false, updated_at = now()
  where product_id = v_product_id and not (id = any(v_variant_ids));

  return v_product_id;
end;
$$;

-- Seller review submission. Completeness checks are repeated in the database so
-- clients cannot submit an empty/invalid catalogue record.
create or replace function public.seller_submit_product_for_review(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_product public.products%rowtype;
  v_seller_status text;
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode = '28000'; end if;

  select verification_status into v_seller_status
  from public.profiles_seller where id = v_user_id;
  if v_seller_status <> 'verified' then
    raise exception 'seller_verification_required' using errcode = '42501';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id and seller_id = v_user_id
  for update;
  if not found then raise exception 'product_not_found_or_access_denied' using errcode = '42501'; end if;
  if v_product.moderation_status = 'pending' then raise exception 'product_already_pending_review'; end if;
  if v_product.status = 'archived' then raise exception 'archived_product_cannot_be_submitted'; end if;

  if not exists (select 1 from public.product_categories where product_id = p_product_id) then
    raise exception 'product_category_required';
  end if;
  if not exists (select 1 from public.product_media where product_id = p_product_id and type = 'image') then
    raise exception 'product_image_required';
  end if;
  if not exists (
    select 1 from public.product_variants
    where product_id = p_product_id and is_active and price > 0
  ) then
    raise exception 'active_product_variant_required';
  end if;

  update public.products
  set status = 'draft',
      moderation_status = 'pending',
      moderation_notes = null,
      submitted_for_review_at = now(),
      moderated_at = null,
      moderated_by = null,
      updated_at = now()
  where id = p_product_id;

  insert into public.product_moderation_events(product_id, actor_id, actor_role, action)
  values (p_product_id, v_user_id, 'seller', 'submitted');
end;
$$;

create or replace function public.seller_set_product_publication(
  p_product_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_moderation text;
  v_seller_status text;
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode = '28000'; end if;

  select p.moderation_status, s.verification_status
  into v_moderation, v_seller_status
  from public.products p
  join public.profiles_seller s on s.id = p.seller_id
  where p.id = p_product_id and p.seller_id = v_user_id
  for update of p;
  if not found then raise exception 'product_not_found_or_access_denied' using errcode = '42501'; end if;

  if p_active then
    if v_moderation <> 'approved' then raise exception 'product_approval_required' using errcode = '42501'; end if;
    if v_seller_status <> 'verified' then raise exception 'seller_verification_required' using errcode = '42501'; end if;
    update public.products set status = 'active', updated_at = now() where id = p_product_id;
    insert into public.product_moderation_events(product_id, actor_id, actor_role, action)
    values (p_product_id, v_user_id, 'seller', 'published');
  else
    update public.products
    set status = case when moderation_status = 'approved' then 'inactive' else 'draft' end,
        updated_at = now()
    where id = p_product_id;
    insert into public.product_moderation_events(product_id, actor_id, actor_role, action)
    values (p_product_id, v_user_id, 'seller', 'unpublished');
  end if;
end;
$$;

create or replace function public.seller_delete_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode = '28000'; end if;
  if not exists (
    select 1 from public.products where id = p_product_id and seller_id = v_user_id
  ) then
    raise exception 'product_not_found_or_access_denied' using errcode = '42501';
  end if;
  if exists (select 1 from public.order_items where product_id = p_product_id) then
    raise exception 'product_has_order_history';
  end if;
  delete from public.products where id = p_product_id and seller_id = v_user_id;
end;
$$;

-- Admin product moderation is service-role-only and verifies the supplied admin
-- identity against trusted auth app_metadata before mutating product state.
create or replace function public.admin_review_product(
  p_admin_id uuid,
  p_product_id uuid,
  p_status text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_product public.products%rowtype;
  v_seller_status text;
begin
  if p_status not in ('approved', 'rejected') then raise exception 'invalid_review_status'; end if;
  if p_status = 'rejected' and nullif(btrim(coalesce(p_notes, '')), '') is null then
    raise exception 'review_notes_required';
  end if;
  if not exists (
    select 1 from auth.users
    where id = p_admin_id and raw_app_meta_data->>'role' = 'admin'
  ) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
  for update;
  if not found then raise exception 'product_not_found'; end if;
  if v_product.moderation_status <> 'pending' then raise exception 'product_not_pending_review'; end if;

  select verification_status into v_seller_status
  from public.profiles_seller where id = v_product.seller_id;

  if p_status = 'approved' then
    if v_seller_status <> 'verified' then raise exception 'seller_verification_required'; end if;
    if not exists (select 1 from public.product_categories where product_id = p_product_id) then
      raise exception 'product_category_required';
    end if;
    if not exists (select 1 from public.product_media where product_id = p_product_id and type = 'image') then
      raise exception 'product_image_required';
    end if;
    if not exists (
      select 1 from public.product_variants
      where product_id = p_product_id and is_active and price > 0
    ) then
      raise exception 'active_product_variant_required';
    end if;
  end if;

  update public.products
  set moderation_status = p_status,
      moderation_notes = nullif(btrim(coalesce(p_notes, '')), ''),
      moderated_at = now(),
      moderated_by = p_admin_id,
      status = case when p_status = 'approved' then 'active' else 'draft' end,
      updated_at = now()
  where id = p_product_id;

  insert into public.product_moderation_events(
    product_id, actor_id, actor_role, action, notes
  ) values (
    p_product_id, p_admin_id, 'admin', p_status,
    nullif(btrim(coalesce(p_notes, '')), '')
  );

  insert into public.admin_audit_logs(
    admin_id, action, target_type, target_id, metadata, timestamp
  ) values (
    p_admin_id,
    'product_moderation',
    'product',
    p_product_id::text,
    jsonb_build_object(
      'product_id', p_product_id,
      'seller_id', v_product.seller_id,
      'decision', p_status,
      'notes', nullif(btrim(coalesce(p_notes, '')), '')
    ),
    now()
  );
end;
$$;

-- Old save RPCs must not remain alternate publication paths.
revoke all on function public.seller_save_product(uuid, text, text, numeric, numeric, text, uuid[], text[], integer)
  from public, anon, authenticated;
revoke all on function public.seller_save_product_v2(uuid, text, text, numeric, numeric, text, uuid[], text[], jsonb)
  from public, anon, authenticated;

revoke all on function public.seller_save_product_v3(uuid, text, text, text, text, numeric, numeric, numeric, uuid, uuid[], text[], jsonb, boolean, boolean, boolean, boolean, integer, text, integer, text[], text[])
  from public, anon;
grant execute on function public.seller_save_product_v3(uuid, text, text, text, text, numeric, numeric, numeric, uuid, uuid[], text[], jsonb, boolean, boolean, boolean, boolean, integer, text, integer, text[], text[])
  to authenticated, service_role;

revoke all on function public.seller_submit_product_for_review(uuid) from public, anon;
grant execute on function public.seller_submit_product_for_review(uuid) to authenticated, service_role;

revoke all on function public.seller_set_product_publication(uuid, boolean) from public, anon;
grant execute on function public.seller_set_product_publication(uuid, boolean) to authenticated, service_role;

revoke all on function public.seller_delete_product(uuid) from public, anon;
grant execute on function public.seller_delete_product(uuid) to authenticated, service_role;

revoke all on function public.admin_review_product(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_review_product(uuid, uuid, text, text)
  to service_role;

commit;
