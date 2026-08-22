\set ON_ERROR_STOP on

-- Structural M2 assertions that complement behavior/regression suites.
do $$
declare
  v_constraint text;
  v_trigger text;
  v_nullable text;
begin
  select is_nullable into v_nullable
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles_seller'
    and column_name = 'store_slug';
  if v_nullable is distinct from 'NO' then
    raise exception 'profiles_seller.store_slug must be NOT NULL';
  end if;

  if to_regclass('public.profiles_seller_store_slug_key') is null then
    raise exception 'Unique Seller store_slug index is missing';
  end if;

  select pg_get_constraintdef(c.oid) into v_constraint
  from pg_constraint c
  where c.conrelid = 'public.products'::regclass
    and c.conname = 'products_active_requires_moderation_approval';
  if v_constraint is null
     or v_constraint not like '%status%active%moderation_status%approved%' then
    raise exception 'Active-product moderation approval invariant is missing';
  end if;

  foreach v_trigger in array array[
    'trg_profiles_seller_store_slug',
    'trg_guard_seller_inventory_reservations',
    'trg_guard_product_moderation_prerequisites',
    'trg_guard_product_moderation_prerequisites_insert'
  ] loop
    if not exists (
      select 1
      from pg_trigger t
      where t.tgname = v_trigger and not t.tgisinternal
    ) then
      raise exception 'Required M2 trigger missing: %', v_trigger;
    end if;
  end loop;

  if has_function_privilege('anon', 'public.guard_seller_inventory_against_reservations()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.guard_seller_inventory_against_reservations()', 'EXECUTE') then
    raise exception 'Inventory guard trigger helper must not be browser-executable';
  end if;

  if has_function_privilege('anon', 'public.guard_product_moderation_prerequisites()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.guard_product_moderation_prerequisites()', 'EXECUTE') then
    raise exception 'Product moderation guard helper must not be browser-executable';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'guard_seller_inventory_against_reservations'
      and 'search_path=pg_catalog, public' = any(coalesce(p.proconfig, array[]::text[]))
  ) then
    raise exception 'Inventory guard lacks hardened search_path';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'guard_product_moderation_prerequisites'
      and 'search_path=pg_catalog, public' = any(coalesce(p.proconfig, array[]::text[]))
  ) then
    raise exception 'Moderation prerequisite guard lacks hardened search_path';
  end if;
end
$$;

select 'M2 database invariants verified' as result;
