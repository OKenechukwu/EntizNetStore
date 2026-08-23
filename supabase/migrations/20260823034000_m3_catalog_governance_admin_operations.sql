-- EntizNetStore combined M3 — audited category/brand governance and active-taxonomy enforcement.

begin;

-- Existing production categories are intentionally adult-classified. Change only
-- the future default so new general-marketplace categories are not silently marked
-- adult unless an Admin explicitly chooses that classification.
alter table public.categories
  alter column is_adult set default false;

-- Brands need a non-destructive retirement state. Historical products may keep a
-- retired brand for display/audit, while new Seller saves cannot select it.
alter table public.brands
  add column if not exists is_active boolean;
update public.brands set is_active = true where is_active is null;
alter table public.brands
  alter column is_active set default true,
  alter column is_active set not null;

create index if not exists idx_categories_active_parent_sort
  on public.categories(is_active, parent_id, sort_order, name);
create index if not exists idx_brands_active_name
  on public.brands(is_active, name);

-- Browser clients may read taxonomy but cannot mutate it directly.
grant select on public.categories, public.brands to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.categories, public.brands from anon, authenticated;
grant all on public.categories, public.brands to service_role;

create or replace function public.admin_save_category(
  p_admin_id uuid,
  p_category_id uuid,
  p_name text,
  p_slug text,
  p_description text,
  p_parent_id uuid,
  p_is_adult boolean,
  p_is_active boolean,
  p_sort_order integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_id uuid := p_category_id;
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_is_adult boolean := coalesce(p_is_adult, false);
  v_is_active boolean := coalesce(p_is_active, true);
  v_sort_order integer := coalesce(p_sort_order, 0);
  v_before jsonb;
  v_action text;
begin
  if p_admin_id is null
     or not exists (
       select 1 from auth.users u
       where u.id = p_admin_id
         and u.raw_app_meta_data->>'role' = 'admin'
     ) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;

  if v_name = '' or char_length(v_name) > 120 then
    raise exception 'invalid_category_name' using errcode = '22023';
  end if;
  if v_description is not null and char_length(v_description) > 4000 then
    raise exception 'category_description_too_long' using errcode = '22023';
  end if;
  if v_sort_order < 0 or v_sort_order > 100000 then
    raise exception 'invalid_category_sort_order' using errcode = '22023';
  end if;

  if v_slug = '' then
    v_slug := btrim(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '-');
  end if;
  if v_slug = '' or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) > 160 then
    raise exception 'invalid_category_slug' using errcode = '22023';
  end if;

  if p_parent_id is not null then
    if p_category_id is not null and p_parent_id = p_category_id then
      raise exception 'category_cannot_parent_itself' using errcode = '22023';
    end if;
    if not exists (select 1 from public.categories c where c.id = p_parent_id) then
      raise exception 'parent_category_not_found' using errcode = '22023';
    end if;
    if v_is_active and exists (
      select 1 from public.categories c where c.id = p_parent_id and coalesce(c.is_active, true) = false
    ) then
      raise exception 'active_category_requires_active_parent' using errcode = '22023';
    end if;
  end if;

  if p_category_id is not null and p_parent_id is not null and exists (
    with recursive descendants as (
      select c.id from public.categories c where c.parent_id = p_category_id
      union all
      select child.id
      from public.categories child
      join descendants d on child.parent_id = d.id
    )
    select 1 from descendants where id = p_parent_id
  ) then
    raise exception 'category_parent_cycle' using errcode = '22023';
  end if;

  if not v_is_active and p_category_id is not null and exists (
    select 1 from public.categories child
    where child.parent_id = p_category_id and coalesce(child.is_active, true)
  ) then
    raise exception 'deactivate_active_subcategories_first' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.categories c
    where c.slug = v_slug and (p_category_id is null or c.id <> p_category_id)
  ) then
    raise exception 'category_slug_already_exists' using errcode = '23505';
  end if;

  if p_category_id is null then
    insert into public.categories(
      parent_id, name, slug, description, is_adult, sort_order, is_active, metadata, created_at, updated_at
    ) values (
      p_parent_id, v_name, v_slug, v_description, v_is_adult, v_sort_order, v_is_active,
      '{}'::jsonb, now(), now()
    ) returning id into v_id;
    v_action := 'catalog_category_created';
  else
    select to_jsonb(c) into v_before from public.categories c where c.id = p_category_id for update;
    if v_before is null then
      raise exception 'category_not_found' using errcode = '22023';
    end if;

    update public.categories
    set parent_id = p_parent_id,
        name = v_name,
        slug = v_slug,
        description = v_description,
        is_adult = v_is_adult,
        sort_order = v_sort_order,
        is_active = v_is_active,
        updated_at = now()
    where id = p_category_id;
    v_action := 'catalog_category_updated';
  end if;

  insert into public.admin_audit_logs(
    admin_id, action, target_type, target_id, metadata, timestamp, created_at
  ) values (
    p_admin_id,
    v_action,
    'category',
    v_id::text,
    jsonb_build_object(
      'before', v_before,
      'after', (select to_jsonb(c) from public.categories c where c.id = v_id)
    ),
    now(), now()
  );

  return v_id;
end;
$$;

create or replace function public.admin_delete_category(
  p_admin_id uuid,
  p_category_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_before jsonb;
begin
  if p_admin_id is null
     or not exists (
       select 1 from auth.users u
       where u.id = p_admin_id
         and u.raw_app_meta_data->>'role' = 'admin'
     ) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;
  if p_category_id is null then
    raise exception 'category_id_required' using errcode = '22023';
  end if;

  select to_jsonb(c) into v_before from public.categories c where c.id = p_category_id for update;
  if v_before is null then
    raise exception 'category_not_found' using errcode = '22023';
  end if;
  if exists (select 1 from public.categories c where c.parent_id = p_category_id) then
    raise exception 'category_has_subcategories' using errcode = '23503';
  end if;
  if exists (select 1 from public.product_categories pc where pc.category_id = p_category_id) then
    raise exception 'category_has_products' using errcode = '23503';
  end if;

  delete from public.categories where id = p_category_id;

  insert into public.admin_audit_logs(
    admin_id, action, target_type, target_id, metadata, timestamp, created_at
  ) values (
    p_admin_id, 'catalog_category_deleted', 'category', p_category_id::text,
    jsonb_build_object('before', v_before), now(), now()
  );
end;
$$;

create or replace function public.admin_save_brand(
  p_admin_id uuid,
  p_brand_id uuid,
  p_name text,
  p_slug text,
  p_description text,
  p_logo_url text,
  p_banner_url text,
  p_website text,
  p_is_verified boolean,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_id uuid := p_brand_id;
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_logo_url text := nullif(btrim(coalesce(p_logo_url, '')), '');
  v_banner_url text := nullif(btrim(coalesce(p_banner_url, '')), '');
  v_website text := nullif(btrim(coalesce(p_website, '')), '');
  v_is_verified boolean := coalesce(p_is_verified, false);
  v_is_active boolean := coalesce(p_is_active, true);
  v_before jsonb;
  v_action text;
begin
  if p_admin_id is null
     or not exists (
       select 1 from auth.users u
       where u.id = p_admin_id
         and u.raw_app_meta_data->>'role' = 'admin'
     ) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;

  if v_name = '' or char_length(v_name) > 120 then
    raise exception 'invalid_brand_name' using errcode = '22023';
  end if;
  if v_description is not null and char_length(v_description) > 4000 then
    raise exception 'brand_description_too_long' using errcode = '22023';
  end if;
  if coalesce(char_length(v_logo_url), 0) > 2000
     or coalesce(char_length(v_banner_url), 0) > 2000
     or coalesce(char_length(v_website), 0) > 2000 then
    raise exception 'brand_url_too_long' using errcode = '22023';
  end if;
  if v_logo_url is not null and v_logo_url !~ '^https?://' then
    raise exception 'invalid_brand_logo_url' using errcode = '22023';
  end if;
  if v_banner_url is not null and v_banner_url !~ '^https?://' then
    raise exception 'invalid_brand_banner_url' using errcode = '22023';
  end if;
  if v_website is not null and v_website !~ '^https?://' then
    raise exception 'invalid_brand_website' using errcode = '22023';
  end if;

  if v_slug = '' then
    v_slug := btrim(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '-');
  end if;
  if v_slug = '' or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) > 160 then
    raise exception 'invalid_brand_slug' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.brands b
    where b.slug = v_slug and (p_brand_id is null or b.id <> p_brand_id)
  ) then
    raise exception 'brand_slug_already_exists' using errcode = '23505';
  end if;

  if p_brand_id is null then
    insert into public.brands(
      name, slug, description, logo_url, banner_url, website,
      is_verified, is_active, metadata, created_at, updated_at
    ) values (
      v_name, v_slug, v_description, v_logo_url, v_banner_url, v_website,
      v_is_verified, v_is_active, '{}'::jsonb, now(), now()
    ) returning id into v_id;
    v_action := 'catalog_brand_created';
  else
    select to_jsonb(b) into v_before from public.brands b where b.id = p_brand_id for update;
    if v_before is null then
      raise exception 'brand_not_found' using errcode = '22023';
    end if;

    update public.brands
    set name = v_name,
        slug = v_slug,
        description = v_description,
        logo_url = v_logo_url,
        banner_url = v_banner_url,
        website = v_website,
        is_verified = v_is_verified,
        is_active = v_is_active,
        updated_at = now()
    where id = p_brand_id;
    v_action := 'catalog_brand_updated';
  end if;

  insert into public.admin_audit_logs(
    admin_id, action, target_type, target_id, metadata, timestamp, created_at
  ) values (
    p_admin_id,
    v_action,
    'brand',
    v_id::text,
    jsonb_build_object(
      'before', v_before,
      'after', (select to_jsonb(b) from public.brands b where b.id = v_id)
    ),
    now(), now()
  );

  return v_id;
end;
$$;

create or replace function public.admin_delete_brand(
  p_admin_id uuid,
  p_brand_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_before jsonb;
begin
  if p_admin_id is null
     or not exists (
       select 1 from auth.users u
       where u.id = p_admin_id
         and u.raw_app_meta_data->>'role' = 'admin'
     ) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;
  if p_brand_id is null then
    raise exception 'brand_id_required' using errcode = '22023';
  end if;

  select to_jsonb(b) into v_before from public.brands b where b.id = p_brand_id for update;
  if v_before is null then
    raise exception 'brand_not_found' using errcode = '22023';
  end if;
  if exists (select 1 from public.products p where p.brand_id = p_brand_id) then
    raise exception 'brand_has_products' using errcode = '23503';
  end if;

  delete from public.brands where id = p_brand_id;

  insert into public.admin_audit_logs(
    admin_id, action, target_type, target_id, metadata, timestamp, created_at
  ) values (
    p_admin_id, 'catalog_brand_deleted', 'brand', p_brand_id::text,
    jsonb_build_object('before', v_before), now(), now()
  );
end;
$$;

-- Taxonomy deactivation is operational, not cosmetic. Seller saves can no
-- longer attach inactive categories/brands while existing historical products
-- remain intact for audit and display.
create or replace function public.guard_active_product_category()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.category_id is null
     or not exists (
       select 1 from public.categories c
       where c.id = new.category_id and coalesce(c.is_active, true)
     ) then
    raise exception 'active_category_required' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_active_product_category on public.product_categories;
create trigger trg_guard_active_product_category
before insert or update of category_id on public.product_categories
for each row execute function public.guard_active_product_category();

create or replace function public.guard_active_product_brand()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.brand_id is not null
     and not exists (
       select 1 from public.brands b
       where b.id = new.brand_id and b.is_active
     ) then
    raise exception 'active_brand_required' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_active_product_brand on public.products;
create trigger trg_guard_active_product_brand
before insert or update of brand_id on public.products
for each row execute function public.guard_active_product_brand();

revoke all on function public.admin_save_category(uuid,uuid,text,text,text,uuid,boolean,boolean,integer)
  from public, anon, authenticated;
grant execute on function public.admin_save_category(uuid,uuid,text,text,text,uuid,boolean,boolean,integer)
  to service_role;
revoke all on function public.admin_delete_category(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.admin_delete_category(uuid,uuid) to service_role;
revoke all on function public.admin_save_brand(uuid,uuid,text,text,text,text,text,text,boolean,boolean)
  from public, anon, authenticated;
grant execute on function public.admin_save_brand(uuid,uuid,text,text,text,text,text,text,boolean,boolean)
  to service_role;
revoke all on function public.admin_delete_brand(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.admin_delete_brand(uuid,uuid) to service_role;
revoke all on function public.guard_active_product_category() from public, anon, authenticated;
revoke all on function public.guard_active_product_brand() from public, anon, authenticated;

commit;
