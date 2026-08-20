-- Atomically create or update a seller-owned product and its core children.
-- Runs as the authenticated caller (security invoker), so existing RLS remains
-- the final authorization boundary.
create or replace function public.seller_save_product(
  p_product_id uuid,
  p_title text,
  p_description text,
  p_base_price numeric,
  p_compare_at_price numeric,
  p_status text,
  p_category_ids uuid[],
  p_media_urls text[],
  p_inventory_quantity integer
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_product_id uuid;
  v_verification_status text;
  v_slug text;
  v_url text;
  v_category_id uuid;
  v_variant_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select verification_status
    into v_verification_status
  from public.profiles_seller
  where id = v_user_id;

  if v_verification_status is null then
    raise exception 'Seller profile required' using errcode = '42501';
  end if;
  if p_status not in ('draft', 'active') then
    raise exception 'Invalid product status' using errcode = '22023';
  end if;
  if p_status = 'active' and v_verification_status <> 'verified' then
    raise exception 'Seller verification is required to publish' using errcode = '42501';
  end if;
  if nullif(trim(p_title), '') is null then
    raise exception 'Product title is required' using errcode = '22023';
  end if;
  if p_base_price is null or p_base_price <= 0 then
    raise exception 'Base price must be greater than zero' using errcode = '22023';
  end if;
  if p_compare_at_price is not null and p_compare_at_price <= p_base_price then
    raise exception 'Compare-at price must be greater than the base price' using errcode = '22023';
  end if;
  if coalesce(p_inventory_quantity, 0) < 0 then
    raise exception 'Inventory cannot be negative' using errcode = '22023';
  end if;

  if p_product_id is null then
    v_slug := trim(both '-' from regexp_replace(lower(trim(p_title)), '[^a-z0-9]+', '-', 'g'))
      || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

    insert into public.products (
      seller_id, title, slug, description, base_price, compare_at_price,
      status, marketplace_brand, track_inventory
    ) values (
      v_user_id, trim(p_title), v_slug, nullif(trim(p_description), ''),
      p_base_price, p_compare_at_price, p_status, 'entiznetstore', true
    )
    returning id into v_product_id;
  else
    update public.products
    set title = trim(p_title),
        description = nullif(trim(p_description), ''),
        base_price = p_base_price,
        compare_at_price = p_compare_at_price,
        status = p_status,
        marketplace_brand = 'entiznetstore',
        track_inventory = true,
        updated_at = now()
    where id = p_product_id and seller_id = v_user_id
    returning id into v_product_id;

    if v_product_id is null then
      raise exception 'Product not found or access denied' using errcode = '42501';
    end if;

    delete from public.product_categories where product_id = v_product_id;
    delete from public.product_media where product_id = v_product_id;
  end if;

  foreach v_category_id in array coalesce(p_category_ids, '{}'::uuid[]) loop
    insert into public.product_categories (product_id, category_id)
    select v_product_id, c.id
    from public.categories c
    where c.id = v_category_id and c.is_active
    on conflict do nothing;
  end loop;

  foreach v_url in array coalesce(p_media_urls, '{}'::text[]) loop
    if nullif(trim(v_url), '') is not null then
      if trim(v_url) !~ '^https?://' then
        raise exception 'Product image URLs must use HTTP or HTTPS' using errcode = '22023';
      end if;
      insert into public.product_media (product_id, type, url, position)
      values (v_product_id, 'image', trim(v_url),
        (select count(*) from public.product_media where product_id = v_product_id));
    end if;
  end loop;

  select id into v_variant_id
  from public.product_variants
  where product_id = v_product_id
  order by position, created_at
  limit 1;

  if v_variant_id is null then
    insert into public.product_variants (
      product_id, title, price, inventory_quantity, track_inventory,
      inventory_policy, is_active, position
    ) values (
      v_product_id, 'Default', p_base_price, coalesce(p_inventory_quantity, 0),
      true, 'deny', true, 0
    );
  else
    update public.product_variants
    set price = p_base_price,
        inventory_quantity = coalesce(p_inventory_quantity, 0),
        track_inventory = true,
        inventory_policy = 'deny',
        is_active = true,
        updated_at = now()
    where id = v_variant_id;
  end if;

  return v_product_id;
end;
$$;

revoke all on function public.seller_save_product(
  uuid, text, text, numeric, numeric, text, uuid[], text[], integer
) from public, anon;
grant execute on function public.seller_save_product(
  uuid, text, text, numeric, numeric, text, uuid[], text[], integer
) to authenticated;
