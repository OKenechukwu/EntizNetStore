create or replace function public.seller_save_product_v2(
  p_product_id uuid,
  p_title text,
  p_description text,
  p_base_price numeric,
  p_compare_at_price numeric,
  p_status text,
  p_category_ids uuid[],
  p_media_urls text[],
  p_variants jsonb
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
  v_variant jsonb;
  v_variant_id uuid;
  v_variant_ids uuid[] := '{}'::uuid[];
  v_position integer := 0;
  v_variant_price numeric;
  v_inventory integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select verification_status into v_verification_status
  from public.profiles_seller where id = v_user_id;

  if v_verification_status is null then
    raise exception 'Seller profile required' using errcode = '42501';
  end if;
  if p_status not in ('draft', 'active') then
    raise exception 'Invalid product status' using errcode = '22023';
  end if;
  if p_status = 'active' and v_verification_status <> 'verified' then
    raise exception 'Seller verification is required to publish' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'Product title is required' using errcode = '22023';
  end if;
  if p_base_price is null or p_base_price <= 0 then
    raise exception 'Base price must be greater than zero' using errcode = '22023';
  end if;
  if p_compare_at_price is not null and p_compare_at_price <= p_base_price then
    raise exception 'Compare-at price must be greater than the base price' using errcode = '22023';
  end if;
  if p_variants is null or jsonb_typeof(p_variants) <> 'array'
     or jsonb_array_length(p_variants) < 1 or jsonb_array_length(p_variants) > 100 then
    raise exception 'One to 100 variants are required' using errcode = '22023';
  end if;

  if p_product_id is null then
    v_slug := btrim(regexp_replace(lower(btrim(p_title)), '[^a-z0-9]+', '-', 'g'), '-')
      || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    insert into public.products (
      seller_id, title, slug, description, base_price, compare_at_price,
      status, marketplace_brand, track_inventory
    ) values (
      v_user_id, btrim(p_title), v_slug, nullif(btrim(p_description), ''),
      p_base_price, p_compare_at_price, p_status, 'entiznetstore', true
    ) returning id into v_product_id;
  else
    update public.products
    set title = btrim(p_title),
        description = nullif(btrim(p_description), ''),
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
    insert into public.product_categories(product_id, category_id)
    select v_product_id, id from public.categories
    where id = v_category_id and is_active
    on conflict do nothing;
  end loop;

  foreach v_url in array coalesce(p_media_urls, '{}'::text[]) loop
    if nullif(btrim(v_url), '') is not null then
      if btrim(v_url) !~ '^https://' then
        raise exception 'Product image URLs must use HTTPS' using errcode = '22023';
      end if;
      insert into public.product_media(product_id, type, url, position)
      values(v_product_id, 'image', btrim(v_url),
        (select count(*) from public.product_media where product_id = v_product_id));
    end if;
  end loop;

  for v_variant in select value from jsonb_array_elements(p_variants) loop
    v_variant_price := (v_variant->>'price')::numeric;
    v_inventory := (v_variant->>'inventoryQuantity')::integer;
    if nullif(btrim(v_variant->>'title'), '') is null then
      raise exception 'Every variant needs a title' using errcode = '22023';
    end if;
    if v_variant_price is null or v_variant_price <= 0 then
      raise exception 'Every variant needs a valid price' using errcode = '22023';
    end if;
    if v_inventory is null or v_inventory < 0 then
      raise exception 'Variant inventory cannot be negative' using errcode = '22023';
    end if;

    v_variant_id := null;
    if nullif(v_variant->>'id', '') is not null then
      update public.product_variants
      set title = btrim(v_variant->>'title'),
          sku = nullif(btrim(v_variant->>'sku'), ''),
          price = v_variant_price,
          inventory_quantity = v_inventory,
          track_inventory = true,
          inventory_policy = 'deny',
          is_active = true,
          position = v_position,
          updated_at = now()
      where id = (v_variant->>'id')::uuid and product_id = v_product_id
      returning id into v_variant_id;
      if v_variant_id is null then
        raise exception 'Variant not found or access denied' using errcode = '42501';
      end if;
    else
      insert into public.product_variants(
        product_id, title, sku, price, inventory_quantity, track_inventory,
        inventory_policy, is_active, position
      ) values (
        v_product_id, btrim(v_variant->>'title'), nullif(btrim(v_variant->>'sku'), ''),
        v_variant_price, v_inventory, true, 'deny', true, v_position
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

revoke all on function public.seller_save_product_v2(
  uuid,text,text,numeric,numeric,text,uuid[],text[],jsonb
) from public, anon;
grant execute on function public.seller_save_product_v2(
  uuid,text,text,numeric,numeric,text,uuid[],text[],jsonb
) to authenticated;
