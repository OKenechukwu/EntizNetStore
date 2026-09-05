\set ON_ERROR_STOP on

-- EntizNetStore M4A structural release gate.
-- This file locks the wholesale authority shape independently of behavioral tests.
-- It is intentionally strict about RLS, direct-write denial, private authority
-- execution, cart mode separation, and durable order pricing evidence.

do $$
declare
  v_table text;
  v_policy text;
  v_idx text;
  v_fn text;
  v_bad integer;
  v_public_definition text;
  v_private_definition text;
begin
  foreach v_table in array array[
    'business_trading_roles',
    'wholesale_offers',
    'wholesale_offer_tiers'
  ] loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'Required M4A table missing: %', v_table;
    end if;

    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_table
        and c.relkind = 'r'
        and c.relrowsecurity
    ) then
      raise exception 'M4A table does not have RLS enabled: %', v_table;
    end if;

    if not has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT') then
      raise exception 'authenticated missing M4A SELECT privilege: %', v_table;
    end if;

    if has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'DELETE')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'TRUNCATE')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'REFERENCES')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'TRIGGER')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'MAINTAIN') then
      raise exception 'M4A authenticated privilege exceeds SELECT-only contract: %', v_table;
    end if;

    if has_table_privilege('anon', format('public.%I', v_table), 'SELECT')
       or has_table_privilege('anon', format('public.%I', v_table), 'INSERT')
       or has_table_privilege('anon', format('public.%I', v_table), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', v_table), 'DELETE')
       or has_table_privilege('anon', format('public.%I', v_table), 'TRUNCATE')
       or has_table_privilege('anon', format('public.%I', v_table), 'REFERENCES')
       or has_table_privilege('anon', format('public.%I', v_table), 'TRIGGER')
       or has_table_privilege('anon', format('public.%I', v_table), 'MAINTAIN') then
      raise exception 'Anonymous M4A table privilege leaked: %', v_table;
    end if;

    if not has_table_privilege('service_role', format('public.%I', v_table), 'SELECT')
       or not has_table_privilege('service_role', format('public.%I', v_table), 'INSERT')
       or not has_table_privilege('service_role', format('public.%I', v_table), 'UPDATE')
       or not has_table_privilege('service_role', format('public.%I', v_table), 'DELETE')
       or not has_table_privilege('service_role', format('public.%I', v_table), 'TRUNCATE')
       or not has_table_privilege('service_role', format('public.%I', v_table), 'REFERENCES')
       or not has_table_privilege('service_role', format('public.%I', v_table), 'TRIGGER')
       or not has_table_privilege('service_role', format('public.%I', v_table), 'MAINTAIN') then
      raise exception 'service_role M4A privilege set incomplete: %', v_table;
    end if;
  end loop;

  foreach v_policy in array array[
    'business_trading_roles_authenticated_select',
    'wholesale_offers_authenticated_select',
    'wholesale_offer_tiers_authenticated_select'
  ] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and policyname = v_policy
    ) then
      raise exception 'Required M4A RLS policy missing: %', v_policy;
    end if;
  end loop;

  foreach v_idx in array array[
    'business_trading_roles_one_primary',
    'idx_wholesale_offers_active_variant',
    'idx_wholesale_offers_seller_status',
    'idx_wholesale_offers_product_id',
    'idx_wholesale_offer_tiers_lookup',
    'cart_items_cart_variant_mode_key',
    'idx_cart_items_wholesale_offer',
    'idx_order_items_wholesale_offer_id'
  ] loop
    if to_regclass('public.' || v_idx) is null then
      raise exception 'Required M4A index/unique contract missing: %', v_idx;
    end if;
  end loop;

  if to_regclass('public.cart_items_cart_variant_key') is not null then
    raise exception 'Legacy retail-only cart uniqueness contract still exists';
  end if;

  foreach v_fn in array array[
    'public.business_set_trading_roles(text[])',
    'public.business_save_wholesale_offer(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamp with time zone,timestamp with time zone,jsonb)',
    'public.buyer_set_wholesale_cart_item(uuid,integer)'
  ] loop
    if has_function_privilege('anon', v_fn, 'EXECUTE')
       or not has_function_privilege('authenticated', v_fn, 'EXECUTE')
       or not has_function_privilege('service_role', v_fn, 'EXECUTE') then
      raise exception 'M4A owner-scoped RPC execution boundary incorrect: %', v_fn;
    end if;
  end loop;

  foreach v_fn in array array[
    'public.guard_wholesale_offer_integrity()',
    'public.guard_wholesale_cart_item_integrity()'
  ] loop
    if has_function_privilege('anon', v_fn, 'EXECUTE')
       or has_function_privilege('authenticated', v_fn, 'EXECUTE')
       or not has_function_privilege('service_role', v_fn, 'EXECUTE') then
      raise exception 'M4A trigger helper execution boundary incorrect: %', v_fn;
    end if;
  end loop;

  -- Only trigger helpers remain public SECURITY DEFINER functions in M4A.
  -- Buyer cart and BSM authoring mutations are invoker wrappers over app_private.
  select count(*) into v_bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'guard_wholesale_offer_integrity',
      'guard_wholesale_cart_item_integrity'
    )
    and (
      not p.prosecdef
      or not ('search_path=pg_catalog, public, app_private' = any(coalesce(p.proconfig, array[]::text[])))
    );
  if v_bad <> 0 then
    raise exception '% retained M4A trigger helpers lost SECURITY DEFINER or hardened app_private search_path', v_bad;
  end if;

  -- BSM trading-role public wrapper/private authority.
  select pg_get_functiondef('public.business_set_trading_roles(text[])'::regprocedure)
    into v_public_definition;
  if exists (
    select 1 from pg_proc
    where oid = 'public.business_set_trading_roles(text[])'::regprocedure
      and prosecdef
  ) then
    raise exception 'Business trading-role public RPC must remain SECURITY INVOKER';
  end if;
  if v_public_definition not ilike '%app_private.business_set_trading_roles_authority%'
     or not (
       v_public_definition ilike '%set search_path to ''pg_catalog''%'
       or v_public_definition ilike '%set search_path = pg_catalog%'
     ) then
    raise exception 'Business trading-role public RPC lost private delegation or pinned search_path';
  end if;

  if has_function_privilege('anon', 'app_private.business_set_trading_roles_authority(text[])', 'EXECUTE')
     or not has_function_privilege('authenticated', 'app_private.business_set_trading_roles_authority(text[])', 'EXECUTE')
     or not has_function_privilege('service_role', 'app_private.business_set_trading_roles_authority(text[])', 'EXECUTE') then
    raise exception 'Business trading-role private authority execution boundary incorrect';
  end if;

  select pg_get_functiondef('app_private.business_set_trading_roles_authority(text[])'::regprocedure)
    into v_private_definition;
  if not exists (
    select 1 from pg_proc
    where oid = 'app_private.business_set_trading_roles_authority(text[])'::regprocedure
      and prosecdef
  )
     or v_private_definition not ilike '%auth.uid()%'
     or v_private_definition not ilike '%profiles_business%'
     or v_private_definition not ilike '%marketplace_capability_is_active%'
     or v_private_definition not ilike '%business_trading_roles%'
     or v_private_definition not ilike '%business_kind%'
     or v_private_definition not ilike '%brand%'
     or v_private_definition not ilike '%supplier%'
     or v_private_definition not ilike '%manufacturer%'
     or v_private_definition not ilike '%distributor%'
     or v_private_definition not ilike '%wholesaler%'
     or v_private_definition not ilike '%retailer%' then
    raise exception 'Business trading-role private authority lost auth/capability/role synchronization controls';
  end if;

  -- BSM wholesale-offer public wrapper/private authority.
  select pg_get_functiondef(
    'public.business_save_wholesale_offer(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamp with time zone,timestamp with time zone,jsonb)'::regprocedure
  ) into v_public_definition;
  if exists (
    select 1 from pg_proc
    where oid = 'public.business_save_wholesale_offer(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamp with time zone,timestamp with time zone,jsonb)'::regprocedure
      and prosecdef
  ) then
    raise exception 'Wholesale-offer public RPC must remain SECURITY INVOKER';
  end if;
  if v_public_definition not ilike '%app_private.business_save_wholesale_offer_authority%'
     or not (
       v_public_definition ilike '%set search_path to ''pg_catalog''%'
       or v_public_definition ilike '%set search_path = pg_catalog%'
     ) then
    raise exception 'Wholesale-offer public RPC lost private delegation or pinned search_path';
  end if;

  if has_function_privilege('anon', 'app_private.business_save_wholesale_offer_authority(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamp with time zone,timestamp with time zone,jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'app_private.business_save_wholesale_offer_authority(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamp with time zone,timestamp with time zone,jsonb)', 'EXECUTE')
     or not has_function_privilege('service_role', 'app_private.business_save_wholesale_offer_authority(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamp with time zone,timestamp with time zone,jsonb)', 'EXECUTE') then
    raise exception 'Wholesale-offer private authority execution boundary incorrect';
  end if;

  select pg_get_functiondef(
    'app_private.business_save_wholesale_offer_authority(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamp with time zone,timestamp with time zone,jsonb)'::regprocedure
  ) into v_private_definition;
  if not exists (
    select 1 from pg_proc
    where oid = 'app_private.business_save_wholesale_offer_authority(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamp with time zone,timestamp with time zone,jsonb)'::regprocedure
      and prosecdef
  )
     or v_private_definition not ilike '%auth.uid()%'
     or v_private_definition not ilike '%profiles_business%'
     or v_private_definition not ilike '%profiles_seller%'
     or v_private_definition not ilike '%marketplace_capability_is_active%'
     or v_private_definition not ilike '%wholesale_offer_catalogue_not_owned%'
     or v_private_definition not ilike '%minimum_order_quantity%'
     or v_private_definition not ilike '%order_multiple%'
     or v_private_definition not ilike '%wholesale_offer_tiers%'
     or v_private_definition not ilike '%first_wholesale_tier_must_equal_moq%'
     or v_private_definition not ilike '%wholesale_offer_activation_requires_verified_active_catalogue%' then
    raise exception 'Wholesale-offer private authority lost auth/ownership/MOQ/tier/activation controls';
  end if;

  -- Buyer wholesale cart public wrapper/private authority.
  select pg_get_functiondef('public.buyer_set_wholesale_cart_item(uuid,integer)'::regprocedure)
    into v_public_definition;
  if exists (
    select 1 from pg_proc
    where oid = 'public.buyer_set_wholesale_cart_item(uuid,integer)'::regprocedure
      and prosecdef
  ) then
    raise exception 'Wholesale cart public RPC must remain SECURITY INVOKER';
  end if;
  if v_public_definition not ilike '%app_private.buyer_set_wholesale_cart_item_authority%'
     or not (
       v_public_definition ilike '%set search_path to ''pg_catalog''%'
       or v_public_definition ilike '%set search_path = pg_catalog%'
     ) then
    raise exception 'Wholesale cart public RPC lost private delegation or pinned search_path';
  end if;

  if has_function_privilege('anon', 'app_private.buyer_set_wholesale_cart_item_authority(uuid,integer)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'app_private.buyer_set_wholesale_cart_item_authority(uuid,integer)', 'EXECUTE')
     or not has_function_privilege('service_role', 'app_private.buyer_set_wholesale_cart_item_authority(uuid,integer)', 'EXECUTE') then
    raise exception 'Wholesale cart private authority execution boundary incorrect';
  end if;

  select pg_get_functiondef('app_private.buyer_set_wholesale_cart_item_authority(uuid,integer)'::regprocedure)
    into v_private_definition;
  if not exists (
    select 1 from pg_proc
    where oid = 'app_private.buyer_set_wholesale_cart_item_authority(uuid,integer)'::regprocedure
      and prosecdef
  )
     or v_private_definition not ilike '%auth.uid()%'
     or v_private_definition not ilike '%set search_path to ''''%'
     or v_private_definition not ilike '%profiles_business%'
     or v_private_definition not ilike '%marketplace_capability_is_active%'
     or v_private_definition not ilike '%minimum_order_quantity%'
     or v_private_definition not ilike '%order_multiple%'
     or v_private_definition not ilike '%wholesale_offer_tiers%'
     or v_private_definition not ilike '%inventory_reservations%'
     or v_private_definition not ilike '%purchase_mode%wholesale%' then
    raise exception 'Wholesale cart private authority lost definer/auth/BSM/MOQ/tier/inventory hardening';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.wholesale_offers'::regclass
      and tgname = 'trg_guard_wholesale_offer_integrity'
      and not tgisinternal
  ) then
    raise exception 'Wholesale-offer integrity trigger missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.cart_items'::regclass
      and tgname = 'trg_guard_wholesale_cart_item_integrity'
      and not tgisinternal
  ) then
    raise exception 'Wholesale cart integrity trigger missing';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Cart mode and immutable order evidence contracts
-- ---------------------------------------------------------------------------
do $$
declare
  v_bad integer;
  v_save_definition text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cart_items'
      and column_name = 'purchase_mode' and data_type = 'text' and is_nullable = 'NO'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cart_items'
      and column_name = 'wholesale_offer_id' and data_type = 'uuid'
  ) then
    raise exception 'Canonical cart is missing M4A purchase-mode authority columns';
  end if;

  select count(*) into v_bad
  from pg_constraint
  where conrelid = 'public.cart_items'::regclass
    and conname in (
      'cart_items_purchase_mode_check',
      'cart_items_purchase_mode_offer_check',
      'cart_items_wholesale_offer_fkey',
      'cart_items_cart_variant_mode_key'
    );
  if v_bad <> 4 then
    raise exception 'Canonical cart M4A constraints incomplete: found % of 4', v_bad;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items'
      and column_name = 'purchase_mode' and data_type = 'text' and is_nullable = 'NO'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items'
      and column_name = 'wholesale_offer_id' and data_type = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items'
      and column_name = 'pricing_snapshot' and data_type = 'jsonb' and is_nullable = 'NO'
  ) then
    raise exception 'Canonical order item is missing durable wholesale pricing evidence';
  end if;

  select count(*) into v_bad
  from pg_constraint
  where conrelid = 'public.order_items'::regclass
    and conname in (
      'order_items_purchase_mode_check',
      'order_items_purchase_mode_offer_check',
      'order_items_wholesale_offer_fkey'
    );
  if v_bad <> 3 then
    raise exception 'Canonical order M4A constraints incomplete: found % of 3', v_bad;
  end if;

  select count(*) into v_bad
  from pg_constraint
  where conrelid = 'public.wholesale_offers'::regclass
    and conname in ('wholesale_offers_moq_check', 'wholesale_offers_order_multiple_check');
  if v_bad <> 2 then
    raise exception 'Wholesale MOQ/order-multiple independent bounds are incomplete: found % of 2', v_bad;
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.wholesale_offers'::regclass
      and conname = 'wholesale_offers_moq_multiple_check'
  ) then
    raise exception 'Legacy MOQ divisibility constraint returned; order multiple must be relative to MOQ';
  end if;

  select pg_get_functiondef(
    'app_private.business_save_wholesale_offer_authority(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamp with time zone,timestamp with time zone,jsonb)'::regprocedure
  ) into v_save_definition;
  if position('p_minimum_order_quantity % p_order_multiple' in v_save_definition) > 0 then
    raise exception 'Wholesale save authority reintroduced invalid MOQ divisibility coupling';
  end if;
  if position('(v_minimum - p_minimum_order_quantity) % p_order_multiple' in v_save_definition) = 0 then
    raise exception 'Wholesale save authority lost MOQ-relative order-multiple alignment';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.wholesale_offer_tiers'::regclass
      and conname = 'wholesale_offer_tiers_offer_minimum_key'
  ) then
    raise exception 'Wholesale tier uniqueness invariant missing';
  end if;
end
$$;

select 'M4A wholesale structural database invariants verified' as result;
