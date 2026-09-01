\set ON_ERROR_STOP on

-- P0 regression: browser-callable SECURITY DEFINER functions are a reviewed
-- privilege surface. Any expansion must fail CI until it is explicitly audited.
do $$
declare
  expected_authenticated text[] := array[
    'business_save_wholesale_offer(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamp with time zone,timestamp with time zone,jsonb)',
    'business_set_trading_roles(text[])',
    'buyer_clear_cart()',
    'buyer_delete_address(uuid)',
    'buyer_get_or_create_cart()',
    'buyer_remove_cart_item(uuid)',
    'buyer_request_order_refund(uuid,bigint,text,uuid)',
    'buyer_save_address(uuid,text,boolean,text,text,text,text,text,text,text,text,text,text,text)',
    'buyer_set_cart_item(uuid,uuid,integer)',
    'buyer_set_wholesale_cart_item(uuid,integer)',
    'buyer_submit_review(uuid,uuid,integer,text,text,boolean)',
    'cancel_checkout_session(uuid)',
    'create_checkout_session_v2(uuid,uuid,uuid)',
    'mark_all_notifications_read()',
    'mark_conversation_read(uuid)',
    'mark_notification_read(uuid)',
    'open_order_dispute(uuid,text,text)',
    'seller_delete_product(uuid)',
    'seller_save_product_v3(uuid,text,text,text,text,numeric,numeric,numeric,uuid,uuid[],text[],jsonb,boolean,boolean,boolean,boolean,integer,text,integer,text[],text[])',
    'seller_set_product_publication(uuid,boolean)',
    'seller_submit_product_for_review(uuid)',
    'submit_marketplace_report(text,uuid,text,text)',
    'transition_seller_order(uuid,text,text,text)'
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
