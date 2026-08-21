-- Complete the production repair if an older deployed function still has the
-- compact insert-only variant block. Fresh databases already have the fixed
-- definition and safely skip this migration.
do $migration$
declare
  v_definition text;
  v_old text := '  insert into public.product_variants (product_id, title, price, inventory_quantity, track_inventory, inventory_policy, is_active, position)' || chr(10) ||
    '  values (v_product_id, ''Default'', p_base_price, coalesce(p_inventory_quantity, 0), true, ''deny'', true, 0);';
  v_new text := '  select id into v_variant_id' || chr(10) ||
    '  from public.product_variants' || chr(10) ||
    '  where product_id = v_product_id' || chr(10) ||
    '  order by position, created_at' || chr(10) ||
    '  limit 1;' || chr(10) || chr(10) ||
    '  if v_variant_id is null then' || chr(10) ||
    '    insert into public.product_variants (product_id, title, price, inventory_quantity, track_inventory, inventory_policy, is_active, position)' || chr(10) ||
    '    values (v_product_id, ''Default'', p_base_price, coalesce(p_inventory_quantity, 0), true, ''deny'', true, 0);' || chr(10) ||
    '  else' || chr(10) ||
    '    update public.product_variants' || chr(10) ||
    '    set price = p_base_price, inventory_quantity = coalesce(p_inventory_quantity, 0), track_inventory = true,' || chr(10) ||
    '        inventory_policy = ''deny'', is_active = true, updated_at = now()' || chr(10) ||
    '    where id = v_variant_id;' || chr(10) ||
    '  end if;';
begin
  select pg_get_functiondef(p.oid) into v_definition
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'seller_save_product';

  if position('update public.product_variants' in v_definition) = 0 then
    if position(v_old in v_definition) = 0 then
      raise exception 'Expected variant insert block not found';
    end if;
    execute replace(v_definition, v_old, v_new);
  end if;
end;
$migration$;
