-- Replace seller_save_product so edits preserve an existing variant ID.
-- order_items may reference variants, so delete-and-recreate is unsafe once
-- orders exist. The complete function definition lives in the preceding
-- migration; this migration performs the production-safe surgical repair.
do $migration$
declare
  v_definition text;
  v_old_insert text := $old$
  insert into public.product_variants (
    product_id, title, price, inventory_quantity, track_inventory,
    inventory_policy, is_active, position
  ) values (
    v_product_id, 'Default', p_base_price, coalesce(p_inventory_quantity, 0),
    true, 'deny', true, 0
  );$old$;
  v_new_save text := $new$
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
  end if;$new$;
begin
  select pg_get_functiondef(p.oid)
    into v_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'seller_save_product';

  if v_definition is null then
    raise exception 'seller_save_product function is missing';
  end if;

  -- Fresh databases already receive the corrected definition from the prior
  -- migration. Existing production databases receive this one-time repair.
  if position('v_variant_id uuid' in v_definition) = 0 then
    v_definition := replace(v_definition, '  v_category_id uuid;',
      '  v_category_id uuid;' || chr(10) || '  v_variant_id uuid;');
    v_definition := replace(v_definition,
      '    delete from public.product_variants where product_id = v_product_id;' || chr(10), '');
    v_definition := replace(v_definition, v_old_insert, v_new_save);
    execute v_definition;
  end if;
end;
$migration$;
