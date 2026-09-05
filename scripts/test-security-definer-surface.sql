\set ON_ERROR_STOP on

-- P0 regression: browser-callable SECURITY DEFINER functions are a reviewed
-- privilege surface. Any expansion must fail CI until it is explicitly audited.
do $$
declare
  expected_authenticated text[] := array[
    'buyer_delete_address(uuid)',
    'buyer_request_order_refund(uuid,bigint,text,uuid)',
    'buyer_save_address(uuid,text,boolean,text,text,text,text,text,text,text,text,text,text,text)',
    'buyer_submit_review(uuid,uuid,integer,text,text,boolean)',
    'cancel_checkout_session(uuid)',
    'create_checkout_session_v2(uuid,uuid,uuid)',
    'mark_all_notifications_read()',
    'mark_conversation_read(uuid)',
    'mark_notification_read(uuid)',
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
-- behavior to the authenticated actor. This prevents an allow-listed function
-- from silently losing its auth.uid() scoping in a later migration.
do $$
declare
  unscoped text[];
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

-- Retail and wholesale cart mutation now use exposed SECURITY INVOKER wrappers
-- over non-exposed app_private SECURITY DEFINER authorities. This removes five
-- browser-callable definers without changing API signatures or caller identity.
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
  fn regprocedure;
  definition text;
  arguments text;
  is_definer boolean;
begin
  foreach fn in array public_fns loop
    if has_function_privilege('anon', fn, 'EXECUTE')
       or not has_function_privilege('authenticated', fn, 'EXECUTE')
       or not has_function_privilege('service_role', fn, 'EXECUTE') then
      raise exception 'cart public wrapper privilege contract changed for %', fn;
    end if;

    select p.prosecdef, pg_get_functiondef(p.oid), pg_get_function_arguments(p.oid)
      into is_definer, definition, arguments
    from pg_proc p where p.oid = fn::oid;

    if is_definer then
      raise exception 'cart public wrapper % must remain SECURITY INVOKER', fn;
    end if;
    if definition not ilike '%app_private.%authority%'
       or not (
         definition ilike '%set search_path to ''pg_catalog''%'
         or definition ilike '%set search_path = pg_catalog%'
       ) then
      raise exception 'cart public wrapper % lost private delegation or pinned search_path', fn;
    end if;
    if arguments ilike '%buyer_id%' or arguments ilike '%user_id%' then
      raise exception 'cart public wrapper % accepts caller-supplied Buyer identity', fn;
    end if;
  end loop;

  foreach fn in array private_fns loop
    if has_function_privilege('anon', fn, 'EXECUTE')
       or not has_function_privilege('authenticated', fn, 'EXECUTE')
       or not has_function_privilege('service_role', fn, 'EXECUTE') then
      raise exception 'cart private authority privilege contract changed for %', fn;
    end if;

    select p.prosecdef, pg_get_functiondef(p.oid), pg_get_function_arguments(p.oid)
      into is_definer, definition, arguments
    from pg_proc p where p.oid = fn::oid;

    if not is_definer
       or definition not ilike '%auth.uid()%'
       or definition not ilike '%set search_path to ''''%' then
      raise exception 'cart private authority % lost definer/auth.uid/empty-search-path hardening', fn;
    end if;
    if arguments ilike '%buyer_id%' or arguments ilike '%user_id%' then
      raise exception 'cart private authority % accepts caller-supplied Buyer identity', fn;
    end if;
  end loop;

  select pg_get_functiondef('app_private.buyer_set_cart_item_authority(uuid,uuid,integer)'::regprocedure::oid)
    into definition;
  if definition not ilike '%marketplace_capability_is_active%'
     or definition not ilike '%inventory_reservations%'
     or definition not ilike '%buyer_get_or_create_cart_authority%'
     or definition not ilike '%purchase_mode%retail%' then
    raise exception 'retail cart private authority lost catalogue/inventory/cart controls';
  end if;

  select pg_get_functiondef('app_private.buyer_set_wholesale_cart_item_authority(uuid,integer)'::regprocedure::oid)
    into definition;
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
    where schemaname = 'private'
      and tablename = 'order_settlement_confirmations'
      and indexname = 'idx_order_settlement_confirmations_confirmed_by'
      and indexdef ilike '%(confirmed_by)%'
  ) then
    raise exception 'settlement confirmation confirmed_by FK index missing';
  end if;
end;
$$;

-- Seller catalogue mutation now follows the same exposed-wrapper/private-authority
-- pattern. Existing audited function objects are moved into app_private, so their
-- validation, ownership, moderation, variant and order-history semantics remain
-- unchanged while elevated execution disappears from the exposed public schema.
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
  fn regprocedure;
  definition text;
  arguments text;
  is_definer boolean;
begin
  foreach fn in array public_fns loop
    if has_function_privilege('anon', fn, 'EXECUTE')
       or not has_function_privilege('authenticated', fn, 'EXECUTE')
       or not has_function_privilege('service_role', fn, 'EXECUTE') then
      raise exception 'seller catalogue public wrapper privilege contract changed for %', fn;
    end if;

    select p.prosecdef, pg_get_functiondef(p.oid), pg_get_function_arguments(p.oid)
      into is_definer, definition, arguments
    from pg_proc p where p.oid = fn::oid;

    if is_definer
       or definition not ilike '%app_private.%authority%'
       or not (
         definition ilike '%set search_path to ''pg_catalog''%'
         or definition ilike '%set search_path = pg_catalog%'
       ) then
      raise exception 'seller catalogue public wrapper % lost invoker/private delegation/search_path hardening', fn;
    end if;
    if arguments ilike '%seller_id%' or arguments ilike '%user_id%' then
      raise exception 'seller catalogue public wrapper % accepts caller-supplied Seller identity', fn;
    end if;
  end loop;

  foreach fn in array private_fns loop
    if has_function_privilege('anon', fn, 'EXECUTE')
       or not has_function_privilege('authenticated', fn, 'EXECUTE')
       or not has_function_privilege('service_role', fn, 'EXECUTE') then
      raise exception 'seller catalogue private authority privilege contract changed for %', fn;
    end if;

    select p.prosecdef, pg_get_functiondef(p.oid), pg_get_function_arguments(p.oid)
      into is_definer, definition, arguments
    from pg_proc p where p.oid = fn::oid;

    if not is_definer
       or definition not ilike '%auth.uid()%'
       or not (
         definition ilike '%set search_path to ''pg_catalog'', ''public''%'
         or definition ilike '%set search_path = pg_catalog, public%'
       ) then
      raise exception 'seller catalogue private authority % lost definer/auth.uid/search_path hardening', fn;
    end if;
    if arguments ilike '%seller_id%' or arguments ilike '%user_id%' then
      raise exception 'seller catalogue private authority % accepts caller-supplied Seller identity', fn;
    end if;
  end loop;

  select pg_get_functiondef('app_private.seller_save_product_v3_authority(uuid,text,text,text,text,numeric,numeric,numeric,uuid,uuid[],text[],jsonb,boolean,boolean,boolean,boolean,integer,text,integer,text[],text[])'::regprocedure::oid)
    into definition;
  if definition not ilike '%profiles_seller%'
     or definition not ilike '%product_variants%'
     or definition not ilike '%product_categories%'
     or definition not ilike '%product_media%'
     or definition not ilike '%product_moderation_events%'
     or definition not ilike '%for update%' then
    raise exception 'seller save private authority lost ownership/catalogue/moderation controls';
  end if;

  select pg_get_functiondef('app_private.seller_submit_product_for_review_authority(uuid)'::regprocedure::oid)
    into definition;
  if definition not ilike '%seller_verification_required%'
     or definition not ilike '%product_category_required%'
     or definition not ilike '%product_image_required%'
     or definition not ilike '%active_product_variant_required%'
     or definition not ilike '%moderation_status%pending%' then
    raise exception 'seller review-submission private authority lost verification/completeness controls';
  end if;

  select pg_get_functiondef('app_private.seller_set_product_publication_authority(uuid,boolean)'::regprocedure::oid)
    into definition;
  if definition not ilike '%product_approval_required%'
     or definition not ilike '%seller_verification_required%'
     or definition not ilike '%product_moderation_events%' then
    raise exception 'seller publication private authority lost approval/verification/audit controls';
  end if;

  select pg_get_functiondef('app_private.seller_delete_product_authority(uuid)'::regprocedure::oid)
    into definition;
  if definition not ilike '%seller_id = v_user_id%'
     or definition not ilike '%order_items%'
     or definition not ilike '%product_has_order_history%' then
    raise exception 'seller delete private authority lost ownership/order-history controls';
  end if;
end;
$$;

-- BSM wholesale authoring now follows the same public-invoker/private-authority
-- pattern as Seller catalogue and cart mutation. This freezes exact signatures,
-- grants, caller identity derivation, capability checks and wholesale invariants.
do $$
declare
  public_roles regprocedure := 'public.business_set_trading_roles(text[])'::regprocedure;
  private_roles regprocedure := 'app_private.business_set_trading_roles_authority(text[])'::regprocedure;
  public_offer regprocedure := 'public.business_save_wholesale_offer(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamp with time zone,timestamp with time zone,jsonb)'::regprocedure;
  private_offer regprocedure := 'app_private.business_save_wholesale_offer_authority(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamp with time zone,timestamp with time zone,jsonb)'::regprocedure;
  fn regprocedure;
  definition text;
  arguments text;
  is_definer boolean;
begin
  foreach fn in array array[public_roles, public_offer] loop
    if has_function_privilege('anon', fn, 'EXECUTE')
       or not has_function_privilege('authenticated', fn, 'EXECUTE')
       or not has_function_privilege('service_role', fn, 'EXECUTE') then
      raise exception 'BSM public wrapper privilege contract changed for %', fn;
    end if;

    select p.prosecdef, pg_get_functiondef(p.oid), pg_get_function_arguments(p.oid)
      into is_definer, definition, arguments
    from pg_proc p where p.oid = fn::oid;

    if is_definer
       or definition not ilike '%app_private.%authority%'
       or not (
         definition ilike '%set search_path to ''pg_catalog''%'
         or definition ilike '%set search_path = pg_catalog%'
       ) then
      raise exception 'BSM public wrapper % lost invoker/private delegation/search_path hardening', fn;
    end if;
    if arguments ilike '%business_id%' or arguments ilike '%seller_id%' or arguments ilike '%user_id%' then
      raise exception 'BSM public wrapper % accepts caller-supplied actor identity', fn;
    end if;
  end loop;

  foreach fn in array array[private_roles, private_offer] loop
    if has_function_privilege('anon', fn, 'EXECUTE')
       or not has_function_privilege('authenticated', fn, 'EXECUTE')
       or not has_function_privilege('service_role', fn, 'EXECUTE') then
      raise exception 'BSM private authority privilege contract changed for %', fn;
    end if;

    select p.prosecdef, pg_get_functiondef(p.oid), pg_get_function_arguments(p.oid)
      into is_definer, definition, arguments
    from pg_proc p where p.oid = fn::oid;

    if not is_definer
       or definition not ilike '%auth.uid()%'
       or not (
         definition ilike '%set search_path to ''pg_catalog'', ''public'', ''app_private''%'
         or definition ilike '%set search_path = pg_catalog, public, app_private%'
       ) then
      raise exception 'BSM private authority % lost definer/auth.uid/search_path hardening', fn;
    end if;
    if arguments ilike '%business_id%' or arguments ilike '%seller_id%' or arguments ilike '%user_id%' then
      raise exception 'BSM private authority % accepts caller-supplied actor identity', fn;
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

-- M5 Store Chat exposes only SECURITY INVOKER wrappers in public. Privileged
-- implementations live in the non-exposed app_private schema. Audit both sides:
-- exact signatures, explicit grants, pinned search paths, auth.uid binding, and
-- the absence of any caller-supplied recipient parameter.
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
  fn regprocedure;
  definition text;
  arguments text;
  is_definer boolean;
begin
  foreach fn in array public_fns loop
    if has_function_privilege('anon', fn, 'EXECUTE')
       or not has_function_privilege('authenticated', fn, 'EXECUTE')
       or not has_function_privilege('service_role', fn, 'EXECUTE') then
      raise exception 'Store Chat public wrapper privilege contract changed for %', fn;
    end if;

    select p.prosecdef, pg_get_functiondef(p.oid), pg_get_function_arguments(p.oid)
      into is_definer, definition, arguments
    from pg_proc p where p.oid = fn::oid;

    if is_definer then
      raise exception 'Store Chat public wrapper % must remain SECURITY INVOKER', fn;
    end if;
    if not (
      definition ilike '%set search_path to ''pg_catalog''%'
      or definition ilike '%set search_path = pg_catalog%'
    ) then
      raise exception 'Store Chat public wrapper % lost pinned search_path', fn;
    end if;
    if arguments ilike '%recipient%' then
      raise exception 'Store Chat public wrapper % accepts caller-supplied recipient authority', fn;
    end if;
  end loop;

  foreach fn in array private_fns loop
    if has_function_privilege('anon', fn, 'EXECUTE')
       or not has_function_privilege('authenticated', fn, 'EXECUTE')
       or not has_function_privilege('service_role', fn, 'EXECUTE') then
      raise exception 'Store Chat private authority privilege contract changed for %', fn;
    end if;

    select p.prosecdef, pg_get_functiondef(p.oid), pg_get_function_arguments(p.oid)
      into is_definer, definition, arguments
    from pg_proc p where p.oid = fn::oid;

    if not is_definer
       or definition not ilike '%auth.uid()%'
       or not (
         definition ilike '%set search_path to ''pg_catalog''%'
         or definition ilike '%set search_path = pg_catalog%'
       ) then
      raise exception 'Store Chat private authority % lost definer/auth.uid/search_path hardening', fn;
    end if;
    if arguments ilike '%recipient%' then
      raise exception 'Store Chat private authority % accepts caller-supplied recipient authority', fn;
    end if;
  end loop;

  select pg_get_functiondef('app_private.open_store_conversation_authority(text,uuid)'::regprocedure::oid)
    into definition;
  if definition not ilike '%p_context_type%'
     or definition not ilike '%p_context_id%'
     or definition not ilike '%store_chat_role_is_active%'
     or definition not ilike '%participant1_id%'
     or definition not ilike '%participant2_id%' then
    raise exception 'private open_store_conversation authority lost context/capability-derived participants';
  end if;

  select pg_get_functiondef('app_private.send_store_message_authority(uuid,text,text,text,text)'::regprocedure::oid)
    into definition;
  if definition not ilike '%v_recipient := v_conversation.participant2_id%'
     or definition not ilike '%v_recipient := v_conversation.participant1_id%'
     or definition not ilike '%store_chat_role_is_active%'
     or definition not ilike '%message_key_envelopes%'
     or definition not ilike '%is_encrypted%'
     or definition not ilike '%encryption_version%' then
    raise exception 'private send_store_message authority lost recipient/capability/encryption controls';
  end if;

  select pg_get_functiondef('app_private.mark_store_conversation_read_authority(uuid)'::regprocedure::oid)
    into definition;
  if definition not ilike '%recipient_id = v_actor%'
     or definition not ilike '%conversation_id = p_conversation_id%' then
    raise exception 'private mark_store_conversation_read authority lost recipient/conversation scoping';
  end if;
end;
$$;

-- Seller fulfillment now follows the same exposed-wrapper/private-authority
-- pattern as Store Chat. The public function is invoker-only. The private
-- definer derives the seller from auth.uid(), locks the order, appends immutable
-- evidence + notification atomically, and must never release escrow.
do $$
declare
  public_fn regprocedure := 'public.transition_seller_order(uuid,text,text,text)'::regprocedure;
  private_fn regprocedure := 'app_private.transition_seller_order_authoritative(uuid,text,text,text)'::regprocedure;
  public_definition text;
  private_definition text;
  public_arguments text;
  private_arguments text;
  public_is_definer boolean;
  private_is_definer boolean;
begin
  if has_function_privilege('anon', public_fn, 'EXECUTE')
     or not has_function_privilege('authenticated', public_fn, 'EXECUTE')
     or not has_function_privilege('service_role', public_fn, 'EXECUTE') then
    raise exception 'fulfillment public wrapper privilege contract changed';
  end if;
  if has_function_privilege('anon', private_fn, 'EXECUTE')
     or not has_function_privilege('authenticated', private_fn, 'EXECUTE')
     or not has_function_privilege('service_role', private_fn, 'EXECUTE') then
    raise exception 'fulfillment private authority privilege contract changed';
  end if;

  select p.prosecdef, pg_get_functiondef(p.oid), pg_get_function_arguments(p.oid)
    into public_is_definer, public_definition, public_arguments
  from pg_proc p where p.oid = public_fn::oid;
  select p.prosecdef, pg_get_functiondef(p.oid), pg_get_function_arguments(p.oid)
    into private_is_definer, private_definition, private_arguments
  from pg_proc p where p.oid = private_fn::oid;

  if public_is_definer then
    raise exception 'fulfillment public wrapper must remain SECURITY INVOKER';
  end if;
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

-- Anonymous callers must never receive direct EXECUTE on public SECURITY
-- DEFINER functions. Public catalogue RLS uses a deliberately non-exposed
-- app_private helper instead of a public RPC.
do $$
declare
  anonymous_surface text[];
begin
  select coalesce(array_agg(signature order by signature), '{}'::text[])
  into anonymous_surface
  from (
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prokind = 'f'
      and p.prosecdef
      and n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ) exposed;

  if cardinality(anonymous_surface) > 0 then
    raise exception 'anonymous SECURITY DEFINER RPC surface must remain empty: %', anonymous_surface;
  end if;
end;
$$;

-- Direct provider-reference mutation is retired from all API roles. The old
-- signatures remain only so historical migrations and provenance remain clear.
do $$
declare
  generic_old regprocedure := 'public.attach_checkout_payment_reference(uuid,text,text)'::regprocedure;
  stripe_old regprocedure := 'public.attach_checkout_payment_intent(uuid,text)'::regprocedure;
  role_name text;
begin
  foreach role_name in array array['anon','authenticated','service_role'] loop
    if has_function_privilege(role_name, generic_old, 'EXECUTE') then
      raise exception '% unexpectedly executes retired attach_checkout_payment_reference', role_name;
    end if;
    if has_function_privilege(role_name, stripe_old, 'EXECUTE') then
      raise exception '% unexpectedly executes retired attach_checkout_payment_intent', role_name;
    end if;
  end loop;
end;
$$;

-- External payment initialization and reconciliation health are service
-- authority only. Browser roles can select their own checkout through RLS, but
-- cannot claim a processor attempt, attach provider identity, manipulate an
-- ambiguous reconciliation state, or inspect reconciliation counts.
do $$
declare
  service_fns regprocedure[] := array[
    'public.service_claim_checkout_payment_initialization(uuid,uuid,uuid)'::regprocedure,
    'public.service_attach_checkout_payment_reference(uuid,uuid,uuid,text,text)'::regprocedure,
    'public.service_mark_checkout_payment_initialization_uncertain(uuid,uuid,uuid)'::regprocedure,
    'public.service_payment_reconciliation_health(integer)'::regprocedure
  ];
  fn regprocedure;
  definition text;
begin
  foreach fn in array service_fns loop
    if has_function_privilege('anon', fn, 'EXECUTE')
       or has_function_privilege('authenticated', fn, 'EXECUTE') then
      raise exception 'browser role can execute service payment authority %', fn;
    end if;
    if not has_function_privilege('service_role', fn, 'EXECUTE') then
      raise exception 'service_role lost payment authority %', fn;
    end if;

    select pg_get_functiondef(fn::oid) into definition;
    if definition not ilike '%security definer%'
       or definition not ilike '%set search_path to ''pg_catalog''%'
          and definition not ilike '%set search_path = pg_catalog%' then
      raise exception 'payment authority % lost SECURITY DEFINER/search_path hardening', fn;
    end if;
  end loop;
end;
$$;

-- Buyer cancellation remains self-authorized, but must stop once trusted server
-- authority has claimed an external processor initialization.
do $$
declare
  fn regprocedure := 'public.cancel_checkout_session(uuid)'::regprocedure;
  definition text;
begin
  if has_function_privilege('anon', fn, 'EXECUTE')
     or not has_function_privilege('authenticated', fn, 'EXECUTE') then
    raise exception 'checkout cancellation browser privilege contract changed';
  end if;

  select pg_get_functiondef(fn::oid) into definition;
  if definition not ilike '%buyer_id = auth.uid()%'
     or definition not ilike '%payment_initialization_attempt_id is null%' then
    raise exception 'checkout cancellation lost actor/initialization-claim guard';
  end if;
end;
$$;

-- Provider reference identity must be unique across checkout sessions.
do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'payment_sessions'
      and indexname = 'idx_payment_sessions_provider_reference_unique'
      and indexdef ilike '%unique index%'
      and indexdef ilike '%payment_provider%'
      and indexdef ilike '%provider_payment_id%'
  ) then
    raise exception 'provider payment reference uniqueness invariant missing';
  end if;
end;
$$;

-- The app_private helper is intentionally callable by database API roles only
-- to support catalogue RLS evaluation. Its schema is not an exposed Data API
-- schema, and the equivalent public RPC remains unavailable to browser roles.
do $$
declare
  private_fn regprocedure := 'app_private.marketplace_capability_is_active(uuid,text)'::regprocedure;
  public_fn regprocedure := 'public.marketplace_capability_is_active(uuid,text)'::regprocedure;
begin
  if not has_schema_privilege('anon', 'app_private', 'USAGE')
     or not has_schema_privilege('authenticated', 'app_private', 'USAGE') then
    raise exception 'catalogue RLS helper schema usage contract changed';
  end if;

  if not has_function_privilege('anon', private_fn, 'EXECUTE')
     or not has_function_privilege('authenticated', private_fn, 'EXECUTE') then
    raise exception 'catalogue RLS helper execution contract changed';
  end if;

  if has_function_privilege('anon', public_fn, 'EXECUTE')
     or has_function_privilege('authenticated', public_fn, 'EXECUTE') then
    raise exception 'public capability probe must not be browser-callable';
  end if;
end;
$$;

select 'security-definer surface regression passed' as result;
