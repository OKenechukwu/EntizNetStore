\set ON_ERROR_STOP on

-- P0 regression: browser-callable SECURITY DEFINER functions are a reviewed
-- privilege surface. Any expansion must fail CI until explicitly audited.
do $$
declare
  expected_authenticated text[] := array[
    'buyer_request_order_refund(uuid,bigint,text,uuid)',
    'cancel_checkout_session(uuid)',
    'create_checkout_session_v2(uuid,uuid,uuid)',
    'open_order_dispute(uuid,text,text)',
    'submit_marketplace_report(text,uuid,text,text)'
  ];
  actual_authenticated text[];
  unexpected text[];
  missing text[];
begin
  select coalesce(array_agg(signature order by signature), '{}'::text[])
  into actual_authenticated
  from (
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prokind = 'f'
      and p.prosecdef
      and n.nspname = 'public'
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) reviewed;

  select coalesce(array_agg(item order by item), '{}'::text[])
  into unexpected
  from unnest(actual_authenticated) as item
  where not (item = any(expected_authenticated));

  select coalesce(array_agg(item order by item), '{}'::text[])
  into missing
  from unnest(expected_authenticated) as item
  where not (item = any(actual_authenticated));

  if cardinality(unexpected) > 0 then
    raise exception 'unexpected authenticated SECURITY DEFINER RPC(s): %', unexpected;
  end if;
  if cardinality(missing) > 0 then
    raise exception 'reviewed authenticated SECURITY DEFINER RPC(s) missing or changed: %', missing;
  end if;
end;
$$;

-- Every retained authenticated SECURITY DEFINER boundary must explicitly bind
-- behavior to the authenticated actor.
do $$
declare unscoped text[];
begin
  select coalesce(array_agg(signature order by signature), '{}'::text[])
  into unscoped
  from (
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prokind = 'f'
      and p.prosecdef
      and n.nspname = 'public'
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and pg_get_functiondef(p.oid) not ilike '%auth.uid()%'
  ) unsafe;
  if cardinality(unscoped) > 0 then
    raise exception 'authenticated SECURITY DEFINER RPC(s) lost auth.uid() scoping: %', unscoped;
  end if;
end;
$$;

-- Retail and wholesale cart mutation: public invokers over private authorities.
do $$
declare
  public_fns regprocedure[] := array[
    'public.buyer_get_or_create_cart()'::regprocedure,
    'public.buyer_set_cart_item(uuid,uuid,integer)'::regprocedure,
    'public.buyer_remove_cart_item(uuid)'::regprocedure,
    'public.buyer_clear_cart()'::regprocedure,
    'public.buyer_set_wholesale_cart_item(uuid,integer)'::regprocedure
  ];
  private_fns regprocedure[] := array[
    'app_private.buyer_get_or_create_cart_authority()'::regprocedure,
    'app_private.buyer_set_cart_item_authority(uuid,uuid,integer)'::regprocedure,
    'app_private.buyer_remove_cart_item_authority(uuid)'::regprocedure,
    'app_private.buyer_clear_cart_authority()'::regprocedure,
    'app_private.buyer_set_wholesale_cart_item_authority(uuid,integer)'::regprocedure
  ];
  fn regprocedure; definition text; arguments text; is_definer boolean;
begin
  foreach fn in array public_fns loop
    if has_function_privilege('anon',fn,'EXECUTE')
       or not has_function_privilege('authenticated',fn,'EXECUTE')
       or not has_function_privilege('service_role',fn,'EXECUTE') then
      raise exception 'cart public wrapper privilege contract changed for %',fn;
    end if;
    select p.prosecdef,pg_get_functiondef(p.oid),pg_get_function_arguments(p.oid)
      into is_definer,definition,arguments from pg_proc p where p.oid=fn::oid;
    if is_definer or definition not ilike '%app_private.%authority%'
       or not (definition ilike '%set search_path to ''pg_catalog''%' or definition ilike '%set search_path = pg_catalog%') then
      raise exception 'cart public wrapper % lost invoker/private delegation/search_path hardening',fn;
    end if;
    if arguments ilike '%buyer_id%' or arguments ilike '%user_id%' then
      raise exception 'cart public wrapper % accepts caller-supplied Buyer identity',fn;
    end if;
  end loop;

  foreach fn in array private_fns loop
    if has_function_privilege('anon',fn,'EXECUTE')
       or not has_function_privilege('authenticated',fn,'EXECUTE')
       or not has_function_privilege('service_role',fn,'EXECUTE') then
      raise exception 'cart private authority privilege contract changed for %',fn;
    end if;
    select p.prosecdef,pg_get_functiondef(p.oid),pg_get_function_arguments(p.oid)
      into is_definer,definition,arguments from pg_proc p where p.oid=fn::oid;
    if not is_definer or definition not ilike '%auth.uid()%'
       or definition not ilike '%set search_path to ''''%' then
      raise exception 'cart private authority % lost definer/auth.uid/empty-search-path hardening',fn;
    end if;
    if arguments ilike '%buyer_id%' or arguments ilike '%user_id%' then
      raise exception 'cart private authority % accepts caller-supplied Buyer identity',fn;
    end if;
  end loop;

  select pg_get_functiondef('app_private.buyer_set_cart_item_authority(uuid,uuid,integer)'::regprocedure::oid) into definition;
  if definition not ilike '%marketplace_capability_is_active%'
     or definition not ilike '%inventory_reservations%'
     or definition not ilike '%buyer_get_or_create_cart_authority%'
     or definition not ilike '%purchase_mode%retail%' then
    raise exception 'retail cart private authority lost catalogue/inventory/cart controls';
  end if;

  select pg_get_functiondef('app_private.buyer_set_wholesale_cart_item_authority(uuid,integer)'::regprocedure::oid) into definition;
  if definition not ilike '%profiles_business%'
     or definition not ilike '%minimum_order_quantity%'
     or definition not ilike '%order_multiple%'
     or definition not ilike '%wholesale_offer_tiers%'
     or definition not ilike '%inventory_reservations%'
     or definition not ilike '%purchase_mode%wholesale%' then
    raise exception 'wholesale cart private authority lost BSM/MOQ/tier/inventory controls';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='private' and tablename='order_settlement_confirmations'
      and indexname='idx_order_settlement_confirmations_confirmed_by'
      and indexdef ilike '%(confirmed_by)%'
  ) then
    raise exception 'settlement confirmation confirmed_by FK index missing';
  end if;
end;
$$;

-- Seller catalogue mutation: public invokers over private authorities.
do $$
declare
  public_fns regprocedure[] := array[
    'public.seller_save_product_v3(uuid,text,text,text,text,numeric,numeric,numeric,uuid,uuid[],text[],jsonb,boolean,boolean,boolean,boolean,integer,text,integer,text[],text[])'::regprocedure,
    'public.seller_delete_product(uuid)'::regprocedure,
    'public.seller_set_product_publication(uuid,boolean)'::regprocedure,
    'public.seller_submit_product_for_review(uuid)'::regprocedure
  ];
  private_fns regprocedure[] := array[
    'app_private.seller_save_product_v3_authority(uuid,text,text,text,text,numeric,numeric,numeric,uuid,uuid[],text[],jsonb,boolean,boolean,boolean,boolean,integer,text,integer,text[],text[])'::regprocedure,
    'app_private.seller_delete_product_authority(uuid)'::regprocedure,
    'app_private.seller_set_product_publication_authority(uuid,boolean)'::regprocedure,
    'app_private.seller_submit_product_for_review_authority(uuid)'::regprocedure
  ];
  fn regprocedure; definition text; arguments text; is_definer boolean;
begin
  foreach fn in array public_fns loop
    if has_function_privilege('anon',fn,'EXECUTE')
       or not has_function_privilege('authenticated',fn,'EXECUTE')
       or not has_function_privilege('service_role',fn,'EXECUTE') then
      raise exception 'seller catalogue public wrapper privilege contract changed for %',fn;
    end if;
    select p.prosecdef,pg_get_functiondef(p.oid),pg_get_function_arguments(p.oid)
      into is_definer,definition,arguments from pg_proc p where p.oid=fn::oid;
    if is_definer or definition not ilike '%app_private.%authority%'
       or not (definition ilike '%set search_path to ''pg_catalog''%' or definition ilike '%set search_path = pg_catalog%') then
      raise exception 'seller catalogue public wrapper % lost invoker/private delegation/search_path hardening',fn;
    end if;
    if arguments ilike '%seller_id%' or arguments ilike '%user_id%' then
      raise exception 'seller catalogue public wrapper % accepts caller-supplied Seller identity',fn;
    end if;
  end loop;

  foreach fn in array private_fns loop
    if has_function_privilege('anon',fn,'EXECUTE')
       or not has_function_privilege('authenticated',fn,'EXECUTE')
       or not has_function_privilege('service_role',fn,'EXECUTE') then
      raise exception 'seller catalogue private authority privilege contract changed for %',fn;
    end if;
    select p.prosecdef,pg_get_functiondef(p.oid),pg_get_function_arguments(p.oid)
      into is_definer,definition,arguments from pg_proc p where p.oid=fn::oid;
    if not is_definer or definition not ilike '%auth.uid()%'
       or not (definition ilike '%set search_path to ''pg_catalog'', ''public''%' or definition ilike '%set search_path = pg_catalog, public%') then
      raise exception 'seller catalogue private authority % lost definer/auth.uid/search_path hardening',fn;
    end if;
    if arguments ilike '%seller_id%' or arguments ilike '%user_id%' then
      raise exception 'seller catalogue private authority % accepts caller-supplied Seller identity',fn;
    end if;
  end loop;

  select pg_get_functiondef('app_private.seller_save_product_v3_authority(uuid,text,text,text,text,numeric,numeric,numeric,uuid,uuid[],text[],jsonb,boolean,boolean,boolean,boolean,integer,text,integer,text[],text[])'::regprocedure::oid) into definition;
  if definition not ilike '%profiles_seller%'
     or definition not ilike '%product_variants%'
     or definition not ilike '%product_categories%'
     or definition not ilike '%product_media%'
     or definition not ilike '%product_moderation_events%'
     or definition not ilike '%for update%' then
    raise exception 'seller save private authority lost ownership/catalogue/moderation controls';
  end if;

  select pg_get_functiondef('app_private.seller_submit_product_for_review_authority(uuid)'::regprocedure::oid) into definition;
  if definition not ilike '%seller_verification_required%'
     or definition not ilike '%product_category_required%'
     or definition not ilike '%product_image_required%'
     or definition not ilike '%active_product_variant_required%'
     or definition not ilike '%moderation_status%pending%' then
    raise exception 'seller review-submission private authority lost verification/completeness controls';
  end if;

  select pg_get_functiondef('app_private.seller_set_product_publication_authority(uuid,boolean)'::regprocedure::oid) into definition;
  if definition not ilike '%product_approval_required%'
     or definition not ilike '%seller_verification_required%'
     or definition not ilike '%product_moderation_events%' then
    raise exception 'seller publication private authority lost approval/verification/audit controls';
  end if;

  select pg_get_functiondef('app_private.seller_delete_product_authority(uuid)'::regprocedure::oid) into definition;
  if definition not ilike '%seller_id = v_user_id%'
     or definition not ilike '%order_items%'
     or definition not ilike '%product_has_order_history%' then
    raise exception 'seller delete private authority lost ownership/order-history controls';
  end if;
end;
$$;

-- BSM wholesale authoring: public invokers over private authorities.
do $$
declare
  public_roles regprocedure := 'public.business_set_trading_roles(text[])'::regprocedure;
  private_roles regprocedure := 'app_private.business_set_trading_roles_authority(text[])'::regprocedure;
  public_offer regprocedure := 'public.business_save_wholesale_offer(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamp with time zone,timestamp with time zone,jsonb)'::regprocedure;
  private_offer regprocedure := 'app_private.business_save_wholesale_offer_authority(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamp with time zone,timestamp with time zone,jsonb)'::regprocedure;
  fn regprocedure; definition text; arguments text; is_definer boolean;
begin
  foreach fn in array array[public_roles,public_offer] loop
    if has_function_privilege('anon',fn,'EXECUTE')
       or not has_function_privilege('authenticated',fn,'EXECUTE')
       or not has_function_privilege('service_role',fn,'EXECUTE') then
      raise exception 'BSM public wrapper privilege contract changed for %',fn;
    end if;
    select p.prosecdef,pg_get_functiondef(p.oid),pg_get_function_arguments(p.oid)
      into is_definer,definition,arguments from pg_proc p where p.oid=fn::oid;
    if is_definer or definition not ilike '%app_private.%authority%'
       or not (definition ilike '%set search_path to ''pg_catalog''%' or definition ilike '%set search_path = pg_catalog%') then
      raise exception 'BSM public wrapper % lost invoker/private delegation/search_path hardening',fn;
    end if;
    if arguments ilike '%business_id%' or arguments ilike '%seller_id%' or arguments ilike '%user_id%' then
      raise exception 'BSM public wrapper % accepts caller-supplied actor identity',fn;
    end if;
  end loop;

  foreach fn in array array[private_roles,private_offer] loop
    if has_function_privilege('anon',fn,'EXECUTE')
       or not has_function_privilege('authenticated',fn,'EXECUTE')
       or not has_function_privilege('service_role',fn,'EXECUTE') then
      raise exception 'BSM private authority privilege contract changed for %',fn;
    end if;
    select p.prosecdef,pg_get_functiondef(p.oid),pg_get_function_arguments(p.oid)
      into is_definer,definition,arguments from pg_proc p where p.oid=fn::oid;
    if not is_definer or definition not ilike '%auth.uid()%'
       or not (definition ilike '%set search_path to ''pg_catalog'', ''public'', ''app_private''%' or definition ilike '%set search_path = pg_catalog, public, app_private%') then
      raise exception 'BSM private authority % lost definer/auth.uid/search_path hardening',fn;
    end if;
    if arguments ilike '%business_id%' or arguments ilike '%seller_id%' or arguments ilike '%user_id%' then
      raise exception 'BSM private authority % accepts caller-supplied actor identity',fn;
    end if;
  end loop;

  select pg_get_functiondef(private_roles::oid) into definition;
  if definition not ilike '%profiles_business%'
     or definition not ilike '%marketplace_capability_is_active%'
     or definition not ilike '%business_trading_roles%'
     or definition not ilike '%business_kind%'
     or definition not ilike '%brand%'
     or definition not ilike '%supplier%'
     or definition not ilike '%manufacturer%'
     or definition not ilike '%distributor%'
     or definition not ilike '%wholesaler%'
     or definition not ilike '%retailer%' then
    raise exception 'BSM trading-role private authority lost business/capability/role controls';
  end if;

  select pg_get_functiondef(private_offer::oid) into definition;
  if definition not ilike '%profiles_business%'
     or definition not ilike '%profiles_seller%'
     or definition not ilike '%marketplace_capability_is_active%'
     or definition not ilike '%wholesale_offer_catalogue_not_owned%'
     or definition not ilike '%minimum_order_quantity%'
     or definition not ilike '%order_multiple%'
     or definition not ilike '%wholesale_offer_tiers%'
     or definition not ilike '%first_wholesale_tier_must_equal_moq%'
     or definition not ilike '%wholesale_offer_activation_requires_verified_active_catalogue%'
     or definition not ilike '%(v_minimum - p_minimum_order_quantity) % p_order_multiple%' then
    raise exception 'BSM wholesale-offer private authority lost ownership/MOQ/tier/activation controls';
  end if;
end;
$$;

-- Buyer address mutation: public invokers over private authorities. Direct table
-- writes remain unavailable to authenticated callers; checkout consumes snapshots.
do $$
declare
  public_save regprocedure := 'public.buyer_save_address(uuid,text,boolean,text,text,text,text,text,text,text,text,text,text,text)'::regprocedure;
  private_save regprocedure := 'app_private.buyer_save_address_authority(uuid,text,boolean,text,text,text,text,text,text,text,text,text,text,text)'::regprocedure;
  public_delete regprocedure := 'public.buyer_delete_address(uuid)'::regprocedure;
  private_delete regprocedure := 'app_private.buyer_delete_address_authority(uuid)'::regprocedure;
  fn regprocedure; definition text; arguments text; is_definer boolean;
begin
  foreach fn in array array[public_save,public_delete] loop
    if has_function_privilege('anon',fn,'EXECUTE')
       or not has_function_privilege('authenticated',fn,'EXECUTE')
       or not has_function_privilege('service_role',fn,'EXECUTE') then
      raise exception 'Buyer address public wrapper privilege contract changed for %',fn;
    end if;
    select p.prosecdef,pg_get_functiondef(p.oid),pg_get_function_arguments(p.oid)
      into is_definer,definition,arguments from pg_proc p where p.oid=fn::oid;
    if is_definer or definition not ilike '%app_private.%authority%'
       or not (definition ilike '%set search_path to ''pg_catalog''%' or definition ilike '%set search_path = pg_catalog%') then
      raise exception 'Buyer address public wrapper % lost invoker/private delegation/search_path hardening',fn;
    end if;
    if arguments ilike '%user_id%' or arguments ilike '%buyer_id%' then
      raise exception 'Buyer address public wrapper % accepts caller-supplied Buyer identity',fn;
    end if;
  end loop;

  foreach fn in array array[private_save,private_delete] loop
    if has_function_privilege('anon',fn,'EXECUTE')
       or not has_function_privilege('authenticated',fn,'EXECUTE')
       or not has_function_privilege('service_role',fn,'EXECUTE') then
      raise exception 'Buyer address private authority privilege contract changed for %',fn;
    end if;
    select p.prosecdef,pg_get_functiondef(p.oid),pg_get_function_arguments(p.oid)
      into is_definer,definition,arguments from pg_proc p where p.oid=fn::oid;
    if not is_definer or definition not ilike '%auth.uid()%'
       or not (definition ilike '%set search_path to ''pg_catalog'', ''public''%' or definition ilike '%set search_path = pg_catalog, public%') then
      raise exception 'Buyer address private authority % lost definer/auth.uid/search_path hardening',fn;
    end if;
    if arguments ilike '%user_id%' or arguments ilike '%buyer_id%' then
      raise exception 'Buyer address private authority % accepts caller-supplied Buyer identity',fn;
    end if;
  end loop;

  select pg_get_functiondef(private_save::oid) into definition;
  if definition not ilike '%profiles_buyer%'
     or definition not ilike '%buyer_profile_required%'
     or definition not ilike '%invalid_address_type%'
     or definition not ilike '%invalid_address%'
     or definition not ilike '%^[A-Z]{2}$%'
     or definition not ilike '%where user_id = v_user_id%'
     or definition not ilike '%is_default = false%'
     or definition not ilike '%where id = p_address_id and user_id = v_user_id%'
     or definition not ilike '%address_not_found_or_access_denied%' then
    raise exception 'Buyer save-address authority lost profile/validation/default/ownership controls';
  end if;

  select pg_get_functiondef(private_delete::oid) into definition;
  if definition not ilike '%delete from public.addresses%'
     or definition not ilike '%id = p_address_id and user_id = v_user_id%'
     or definition not ilike '%address_not_found_or_access_denied%' then
    raise exception 'Buyer delete-address authority lost ownership/access-denial controls';
  end if;

  if has_table_privilege('authenticated','public.addresses','INSERT')
     or has_table_privilege('authenticated','public.addresses','UPDATE')
     or has_table_privilege('authenticated','public.addresses','DELETE') then
    raise exception 'authenticated callers gained direct address write privileges';
  end if;
  if not has_table_privilege('authenticated','public.addresses','SELECT') then
    raise exception 'authenticated callers lost address read privilege';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='addresses'
      and policyname='addresses_buyer_select_own' and cmd='SELECT'
      and qual ilike '%auth.uid()%'
  ) then
    raise exception 'Buyer own-address SELECT RLS policy missing or changed';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and tablename='addresses'
      and indexname='addresses_one_default_per_user_type'
      and indexdef ilike '%unique index%'
      and indexdef ilike '%(user_id, type)%'
      and indexdef ilike '%where is_default%'
  ) then
    raise exception 'one-default-address-per-user/type invariant missing';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='cart_quotes' and column_name='shipping_address' and data_type='jsonb')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='payment_sessions' and column_name='shipping_address' and data_type='jsonb')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='shipping_address' and data_type='jsonb') then
    raise exception 'checkout/order address snapshot contract missing';
  end if;
end;
$$;

-- Notification read-state mutation: public invokers over private authorities.
-- The private implementations retain auth.uid() ownership, null-ID rejection,
-- read/updated_at mutation and mark-all affected-row count semantics.
do $$
declare
  public_one regprocedure := 'public.mark_notification_read(uuid)'::regprocedure;
  private_one regprocedure := 'app_private.mark_notification_read_authority(uuid)'::regprocedure;
  public_all regprocedure := 'public.mark_all_notifications_read()'::regprocedure;
  private_all regprocedure := 'app_private.mark_all_notifications_read_authority()'::regprocedure;
  fn regprocedure; definition text; arguments text; is_definer boolean;
begin
  foreach fn in array array[public_one,public_all] loop
    if has_function_privilege('anon',fn,'EXECUTE')
       or not has_function_privilege('authenticated',fn,'EXECUTE')
       or not has_function_privilege('service_role',fn,'EXECUTE') then
      raise exception 'notification public wrapper privilege contract changed for %',fn;
    end if;
    select p.prosecdef,pg_get_functiondef(p.oid),pg_get_function_arguments(p.oid)
      into is_definer,definition,arguments from pg_proc p where p.oid=fn::oid;
    if is_definer or definition not ilike '%app_private.%authority%'
       or not (definition ilike '%set search_path to ''pg_catalog''%' or definition ilike '%set search_path = pg_catalog%') then
      raise exception 'notification public wrapper % lost invoker/private delegation/search_path hardening',fn;
    end if;
    if arguments ilike '%user_id%' or arguments ilike '%recipient_id%' then
      raise exception 'notification public wrapper % accepts caller-supplied recipient identity',fn;
    end if;
  end loop;

  foreach fn in array array[private_one,private_all] loop
    if has_function_privilege('anon',fn,'EXECUTE')
       or not has_function_privilege('authenticated',fn,'EXECUTE')
       or not has_function_privilege('service_role',fn,'EXECUTE') then
      raise exception 'notification private authority privilege contract changed for %',fn;
    end if;
    select p.prosecdef,pg_get_functiondef(p.oid),pg_get_function_arguments(p.oid)
      into is_definer,definition,arguments from pg_proc p where p.oid=fn::oid;
    if not is_definer or definition not ilike '%auth.uid()%'
       or not (definition ilike '%set search_path to ''pg_catalog'', ''public''%' or definition ilike '%set search_path = pg_catalog, public%') then
      raise exception 'notification private authority % lost definer/auth.uid/search_path hardening',fn;
    end if;
    if arguments ilike '%user_id%' or arguments ilike '%recipient_id%' then
      raise exception 'notification private authority % accepts caller-supplied recipient identity',fn;
    end if;
  end loop;

  select pg_get_functiondef(private_one::oid) into definition;
  if definition not ilike '%notification_id_required%'
     or definition not ilike '%update public.notifications%'
     or definition not ilike '%set read = true%'
     or definition not ilike '%updated_at = now()%'
     or definition not ilike '%id = p_notification_id%'
     or definition not ilike '%user_id = v_user%'
     or definition not ilike '%notification_not_found_or_not_owned%' then
    raise exception 'single-notification authority lost ID/ownership/read-state controls';
  end if;

  select pg_get_functiondef(private_all::oid) into definition;
  if definition not ilike '%update public.notifications%'
     or definition not ilike '%set read = true%'
     or definition not ilike '%updated_at = now()%'
     or definition not ilike '%where user_id = v_user%'
     or definition not ilike '%coalesce(read, false) = false%'
     or definition not ilike '%get diagnostics v_count = row_count%'
     or definition not ilike '%return v_count%' then
    raise exception 'mark-all notification authority lost ownership/read-state/row-count controls';
  end if;
end;
$$;

-- Legacy conversation read-state mutation: public invoker over the preserved
-- private SECURITY DEFINER authority. Only unread messages addressed to auth.uid()
-- in the supplied conversation may be changed; existing read_at is never replaced.
do $$
declare
  public_fn regprocedure := 'public.mark_conversation_read(uuid)'::regprocedure;
  private_fn regprocedure := 'app_private.mark_conversation_read_authority(uuid)'::regprocedure;
  public_definition text; private_definition text; public_arguments text; private_arguments text;
  public_is_definer boolean; private_is_definer boolean;
begin
  if has_function_privilege('anon',public_fn,'EXECUTE')
     or not has_function_privilege('authenticated',public_fn,'EXECUTE')
     or not has_function_privilege('service_role',public_fn,'EXECUTE') then
    raise exception 'conversation-read public wrapper privilege contract changed';
  end if;
  if has_function_privilege('anon',private_fn,'EXECUTE')
     or not has_function_privilege('authenticated',private_fn,'EXECUTE')
     or not has_function_privilege('service_role',private_fn,'EXECUTE') then
    raise exception 'conversation-read private authority privilege contract changed';
  end if;

  select p.prosecdef,pg_get_functiondef(p.oid),pg_get_function_arguments(p.oid)
    into public_is_definer,public_definition,public_arguments
    from pg_proc p where p.oid=public_fn::oid;
  select p.prosecdef,pg_get_functiondef(p.oid),pg_get_function_arguments(p.oid)
    into private_is_definer,private_definition,private_arguments
    from pg_proc p where p.oid=private_fn::oid;

  if public_is_definer
     or public_definition not ilike '%app_private.mark_conversation_read_authority%'
     or not (public_definition ilike '%set search_path to ''pg_catalog''%' or public_definition ilike '%set search_path = pg_catalog%') then
    raise exception 'conversation-read public wrapper lost invoker/private delegation/search_path hardening';
  end if;
  if public_arguments ilike '%recipient_id%' or public_arguments ilike '%user_id%' then
    raise exception 'conversation-read public wrapper accepts caller-supplied recipient identity';
  end if;

  if not private_is_definer
     or private_definition not ilike '%auth.uid()%'
     or private_definition not ilike '%set search_path to ''''%'
     or private_definition not ilike '%update public.messages%'
     or private_definition not ilike '%set is_read = true%'
     or private_definition not ilike '%read_at = coalesce(read_at, now())%'
     or private_definition not ilike '%updated_at = now()%'
     or private_definition not ilike '%conversation_id = target_conversation_id%'
     or private_definition not ilike '%recipient_id = auth.uid()%'
     or private_definition not ilike '%and not is_read%' then
    raise exception 'conversation-read private authority lost recipient/unread/read_at controls';
  end if;
  if private_arguments ilike '%recipient_id%' or private_arguments ilike '%user_id%' then
    raise exception 'conversation-read private authority accepts caller-supplied recipient identity';
  end if;
end;
$$;

-- Buyer review submission: public invoker over a private authority while preserving
-- Buyer identity, delivered-purchase eligibility, validation, uniqueness and pending moderation.
do $$
declare
  public_fn regprocedure := 'public.buyer_submit_review(uuid,uuid,integer,text,text,boolean)'::regprocedure;
  private_fn regprocedure := 'app_private.buyer_submit_review_authority(uuid,uuid,integer,text,text,boolean)'::regprocedure;
  public_definition text; private_definition text; public_arguments text; private_arguments text;
  public_is_definer boolean; private_is_definer boolean;
begin
  if has_function_privilege('anon',public_fn,'EXECUTE')
     or not has_function_privilege('authenticated',public_fn,'EXECUTE')
     or not has_function_privilege('service_role',public_fn,'EXECUTE') then
    raise exception 'Buyer review public wrapper privilege contract changed';
  end if;
  if has_function_privilege('anon',private_fn,'EXECUTE')
     or not has_function_privilege('authenticated',private_fn,'EXECUTE')
     or not has_function_privilege('service_role',private_fn,'EXECUTE') then
    raise exception 'Buyer review private authority privilege contract changed';
  end if;

  select p.prosecdef,pg_get_functiondef(p.oid),pg_get_function_arguments(p.oid)
    into public_is_definer,public_definition,public_arguments
    from pg_proc p where p.oid=public_fn::oid;
  select p.prosecdef,pg_get_functiondef(p.oid),pg_get_function_arguments(p.oid)
    into private_is_definer,private_definition,private_arguments
    from pg_proc p where p.oid=private_fn::oid;

  if public_is_definer
     or public_definition not ilike '%app_private.buyer_submit_review_authority%'
     or not (public_definition ilike '%set search_path to ''pg_catalog''%' or public_definition ilike '%set search_path = pg_catalog%') then
    raise exception 'Buyer review public wrapper lost invoker/private delegation/search_path hardening';
  end if;
  if public_arguments ilike '%buyer_id%' or public_arguments ilike '%user_id%' then
    raise exception 'Buyer review public wrapper accepts caller-supplied Buyer identity';
  end if;

  if not private_is_definer
     or private_definition not ilike '%auth.uid()%'
     or not (private_definition ilike '%set search_path to ''pg_catalog'', ''public''%' or private_definition ilike '%set search_path = pg_catalog, public%')
     or private_definition not ilike '%marketplace_capability_is_active(v_buyer,''buyer'')%'
     or private_definition not ilike '%p_rating<1 or p_rating>5%'
     or private_definition not ilike '%char_length(v_title)>200%'
     or private_definition not ilike '%char_length(v_content)>5000%'
     or private_definition not ilike '%review_text_required%'
     or private_definition not ilike '%o.buyer_id=v_buyer%'
     or private_definition not ilike '%o.status=''delivered''%'
     or private_definition not ilike '%o.payment_status in (''paid'',''partially_refunded'',''refunded'')%'
     or private_definition not ilike '%oi.product_id=p_product_id%'
     or private_definition not ilike '%review_already_submitted_for_order_product%'
     or private_definition not ilike '%is_verified_purchase%'
     or private_definition not ilike '%coalesce(p_is_anonymous,false)%'
     or private_definition not ilike '%''pending''%'
     or private_definition not ilike '%return v_review_id%' then
    raise exception 'Buyer review private authority lost eligibility/validation/uniqueness/moderation controls';
  end if;
  if private_arguments ilike '%buyer_id%' or private_arguments ilike '%user_id%' then
    raise exception 'Buyer review private authority accepts caller-supplied Buyer identity';
  end if;
end;
$$;

-- M5 Store Chat exposed wrappers/private authorities.
do $$
declare
  public_fns regprocedure[] := array[
    'public.open_store_conversation(text,uuid)'::regprocedure,
    'public.send_store_message(uuid,text,text,text,text)'::regprocedure,
    'public.mark_store_conversation_read(uuid)'::regprocedure
  ];
  private_fns regprocedure[] := array[
    'app_private.open_store_conversation_authority(text,uuid)'::regprocedure,
    'app_private.send_store_message_authority(uuid,text,text,text,text)'::regprocedure,
    'app_private.mark_store_conversation_read_authority(uuid)'::regprocedure
  ];
  fn regprocedure; definition text; arguments text; is_definer boolean;
begin
  foreach fn in array public_fns loop
    if has_function_privilege('anon',fn,'EXECUTE')
       or not has_function_privilege('authenticated',fn,'EXECUTE')
       or not has_function_privilege('service_role',fn,'EXECUTE') then
      raise exception 'Store Chat public wrapper privilege contract changed for %',fn;
    end if;
    select p.prosecdef,pg_get_functiondef(p.oid),pg_get_function_arguments(p.oid)
      into is_definer,definition,arguments from pg_proc p where p.oid=fn::oid;
    if is_definer then
      raise exception 'Store Chat public wrapper % must remain SECURITY INVOKER',fn;
    end if;
    if not (definition ilike '%set search_path to ''pg_catalog''%' or definition ilike '%set search_path = pg_catalog%') then
      raise exception 'Store Chat public wrapper % lost pinned search_path',fn;
    end if;
    if arguments ilike '%recipient%' then
      raise exception 'Store Chat public wrapper % accepts caller-supplied recipient authority',fn;
    end if;
  end loop;

  foreach fn in array private_fns loop
    if has_function_privilege('anon',fn,'EXECUTE')
       or not has_function_privilege('authenticated',fn,'EXECUTE')
       or not has_function_privilege('service_role',fn,'EXECUTE') then
      raise exception 'Store Chat private authority privilege contract changed for %',fn;
    end if;
    select p.prosecdef,pg_get_functiondef(p.oid),pg_get_function_arguments(p.oid)
      into is_definer,definition,arguments from pg_proc p where p.oid=fn::oid;
    if not is_definer or definition not ilike '%auth.uid()%'
       or not (definition ilike '%set search_path to ''pg_catalog''%' or definition ilike '%set search_path = pg_catalog%') then
      raise exception 'Store Chat private authority % lost definer/auth.uid/search_path hardening',fn;
    end if;
    if arguments ilike '%recipient%' then
      raise exception 'Store Chat private authority % accepts caller-supplied recipient authority',fn;
    end if;
  end loop;

  select pg_get_functiondef('app_private.open_store_conversation_authority(text,uuid)'::regprocedure::oid) into definition;
  if definition not ilike '%p_context_type%'
     or definition not ilike '%p_context_id%'
     or definition not ilike '%store_chat_role_is_active%'
     or definition not ilike '%participant1_id%'
     or definition not ilike '%participant2_id%' then
    raise exception 'private open_store_conversation authority lost context/capability-derived participants';
  end if;

  select pg_get_functiondef('app_private.send_store_message_authority(uuid,text,text,text,text)'::regprocedure::oid) into definition;
  if definition not ilike '%v_recipient := v_conversation.participant2_id%'
     or definition not ilike '%v_recipient := v_conversation.participant1_id%'
     or definition not ilike '%store_chat_role_is_active%'
     or definition not ilike '%message_key_envelopes%'
     or definition not ilike '%is_encrypted%'
     or definition not ilike '%encryption_version%' then
    raise exception 'private send_store_message authority lost recipient/capability/encryption controls';
  end if;

  select pg_get_functiondef('app_private.mark_store_conversation_read_authority(uuid)'::regprocedure::oid) into definition;
  if definition not ilike '%recipient_id = v_actor%'
     or definition not ilike '%conversation_id = p_conversation_id%' then
    raise exception 'private mark_store_conversation_read authority lost recipient/conversation scoping';
  end if;
end;
$$;

-- Seller fulfillment public wrapper/private authority.
do $$
declare
  public_fn regprocedure := 'public.transition_seller_order(uuid,text,text,text)'::regprocedure;
  private_fn regprocedure := 'app_private.transition_seller_order_authoritative(uuid,text,text,text)'::regprocedure;
  public_definition text; private_definition text; public_arguments text; private_arguments text;
  public_is_definer boolean; private_is_definer boolean;
begin
  if has_function_privilege('anon',public_fn,'EXECUTE')
     or not has_function_privilege('authenticated',public_fn,'EXECUTE')
     or not has_function_privilege('service_role',public_fn,'EXECUTE') then
    raise exception 'fulfillment public wrapper privilege contract changed';
  end if;
  if has_function_privilege('anon',private_fn,'EXECUTE')
     or not has_function_privilege('authenticated',private_fn,'EXECUTE')
     or not has_function_privilege('service_role',private_fn,'EXECUTE') then
    raise exception 'fulfillment private authority privilege contract changed';
  end if;
  select p.prosecdef,pg_get_functiondef(p.oid),pg_get_function_arguments(p.oid)
    into public_is_definer,public_definition,public_arguments from pg_proc p where p.oid=public_fn::oid;
  select p.prosecdef,pg_get_functiondef(p.oid),pg_get_function_arguments(p.oid)
    into private_is_definer,private_definition,private_arguments from pg_proc p where p.oid=private_fn::oid;
  if public_is_definer then raise exception 'fulfillment public wrapper must remain SECURITY INVOKER'; end if;
  if public_definition not ilike '%app_private.transition_seller_order_authoritative%'
     or public_definition not ilike '%set search_path to ''''%' then
    raise exception 'fulfillment public wrapper lost private delegation or empty search_path';
  end if;
  if not private_is_definer
     or private_definition not ilike '%auth.uid()%'
     or private_definition not ilike '%for update%'
     or private_definition not ilike '%insert into public.order_fulfillment_events%'
     or private_definition not ilike '%insert into public.notifications%'
     or private_definition not ilike '%set search_path to ''''%' then
    raise exception 'fulfillment private authority lost definer/auth/lock/evidence/search_path hardening';
  end if;
  if private_definition ilike '%update public.escrow_transactions%'
     or private_definition ilike '%delete from public.escrow_transactions%' then
    raise exception 'fulfillment private authority must never mutate escrow';
  end if;
  if public_arguments ilike '%seller_id%' or private_arguments ilike '%seller_id%' then
    raise exception 'fulfillment authority must not accept caller-supplied seller identity';
  end if;
end;
$$;

-- Anonymous callers must never execute public SECURITY DEFINER functions.
do $$
declare anonymous_surface text[];
begin
  select coalesce(array_agg(signature order by signature),'{}'::text[])
  into anonymous_surface
  from (
    select p.oid::regprocedure::text signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where p.prokind='f' and p.prosecdef and n.nspname='public'
      and has_function_privilege('anon',p.oid,'EXECUTE')
  ) exposed;
  if cardinality(anonymous_surface)>0 then
    raise exception 'anonymous SECURITY DEFINER RPC surface must remain empty: %',anonymous_surface;
  end if;
end;
$$;

-- Retired provider-reference mutations stay inaccessible.
do $$
declare
  generic_old regprocedure := 'public.attach_checkout_payment_reference(uuid,text,text)'::regprocedure;
  stripe_old regprocedure := 'public.attach_checkout_payment_intent(uuid,text)'::regprocedure;
  role_name text;
begin
  foreach role_name in array array['anon','authenticated','service_role'] loop
    if has_function_privilege(role_name,generic_old,'EXECUTE') then
      raise exception '% unexpectedly executes retired attach_checkout_payment_reference',role_name;
    end if;
    if has_function_privilege(role_name,stripe_old,'EXECUTE') then
      raise exception '% unexpectedly executes retired attach_checkout_payment_intent',role_name;
    end if;
  end loop;
end;
$$;

-- Payment initialization/reconciliation remains service authority only.
do $$
declare
  service_fns regprocedure[] := array[
    'public.service_claim_checkout_payment_initialization(uuid,uuid,uuid)'::regprocedure,
    'public.service_attach_checkout_payment_reference(uuid,uuid,uuid,text,text)'::regprocedure,
    'public.service_mark_checkout_payment_initialization_uncertain(uuid,uuid,uuid)'::regprocedure,
    'public.service_payment_reconciliation_health(integer)'::regprocedure
  ];
  fn regprocedure; definition text;
begin
  foreach fn in array service_fns loop
    if has_function_privilege('anon',fn,'EXECUTE')
       or has_function_privilege('authenticated',fn,'EXECUTE') then
      raise exception 'browser role can execute service payment authority %',fn;
    end if;
    if not has_function_privilege('service_role',fn,'EXECUTE') then
      raise exception 'service_role lost payment authority %',fn;
    end if;
    select pg_get_functiondef(fn::oid) into definition;
    if definition not ilike '%security definer%'
       or not (definition ilike '%set search_path to ''pg_catalog''%' or definition ilike '%set search_path = pg_catalog%') then
      raise exception 'payment authority % lost SECURITY DEFINER/search_path hardening',fn;
    end if;
  end loop;
end;
$$;

-- Buyer cancellation must stop after trusted processor initialization claim.
do $$
declare fn regprocedure := 'public.cancel_checkout_session(uuid)'::regprocedure; definition text;
begin
  if has_function_privilege('anon',fn,'EXECUTE')
     or not has_function_privilege('authenticated',fn,'EXECUTE') then
    raise exception 'checkout cancellation browser privilege contract changed';
  end if;
  select pg_get_functiondef(fn::oid) into definition;
  if definition not ilike '%buyer_id = auth.uid()%'
     or definition not ilike '%payment_initialization_attempt_id is null%' then
    raise exception 'checkout cancellation lost actor/initialization-claim guard';
  end if;
end;
$$;

-- Provider reference identity remains globally unique across checkout sessions.
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and tablename='payment_sessions'
      and indexname='idx_payment_sessions_provider_reference_unique'
      and indexdef ilike '%unique index%'
      and indexdef ilike '%payment_provider%'
      and indexdef ilike '%provider_payment_id%'
  ) then
    raise exception 'provider payment reference uniqueness invariant missing';
  end if;
end;
$$;

-- app_private marketplace capability helper remains RLS-only, not a public RPC.
do $$
declare
  private_fn regprocedure := 'app_private.marketplace_capability_is_active(uuid,text)'::regprocedure;
  public_fn regprocedure := 'public.marketplace_capability_is_active(uuid,text)'::regprocedure;
begin
  if not has_schema_privilege('anon','app_private','USAGE')
     or not has_schema_privilege('authenticated','app_private','USAGE') then
    raise exception 'catalogue RLS helper schema usage contract changed';
  end if;
  if not has_function_privilege('anon',private_fn,'EXECUTE')
     or not has_function_privilege('authenticated',private_fn,'EXECUTE') then
    raise exception 'catalogue RLS helper execution contract changed';
  end if;
  if has_function_privilege('anon',public_fn,'EXECUTE')
     or has_function_privilege('authenticated',public_fn,'EXECUTE') then
    raise exception 'public capability probe must not be browser-callable';
  end if;
end;
$$;

select 'security-definer surface regression passed' as result;
