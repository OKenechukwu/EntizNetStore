\set ON_ERROR_STOP on

-- P0 regression: unresolved payment initialization must become an operational
-- readiness signal without exposing checkout/payment identifiers to browsers.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  'a1000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'payment-health-buyer@test.invalid', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.profiles_buyer(id, display_name)
values ('a1000000-0000-0000-0000-000000000001', 'Payment Health Buyer');

-- Browser roles never receive this reconciliation surface. Inspect pg_proc
-- configuration directly instead of depending on pg_get_functiondef formatting.
do $$
declare
  fn regprocedure := 'public.service_payment_reconciliation_health(integer)'::regprocedure;
  definition text;
  is_security_definer boolean;
  function_config text[];
begin
  if has_function_privilege('anon', fn, 'EXECUTE') then
    raise exception 'anon can execute payment reconciliation health';
  end if;
  if has_function_privilege('authenticated', fn, 'EXECUTE') then
    raise exception 'authenticated can execute payment reconciliation health';
  end if;
  if not has_function_privilege('service_role', fn, 'EXECUTE') then
    raise exception 'service_role cannot execute payment reconciliation health';
  end if;

  select p.prosecdef, p.proconfig, pg_get_functiondef(p.oid)
  into is_security_definer, function_config, definition
  from pg_proc p
  where p.oid = fn::oid;

  if not is_security_definer
     or not ('search_path=pg_catalog, public' = any(coalesce(function_config, '{}'::text[])))
     or definition not ilike '%payment_initialization_started_at%'
     or definition not ilike '%payment_initialization_uncertain%'
     or definition not ilike '%provider_payment_id is null%'
     or definition not ilike '%stripe_payment_intent_id is null%'
     or definition not ilike '%status in (''pending'', ''requires_payment'')%' then
    raise exception 'payment reconciliation health authority lost hardened semantics';
  end if;
end
$$;

-- Readiness is public traffic, so both negative-path scans must stay on narrow
-- active partial indexes rather than growing into full historical payment scans.
do $$
declare
  unbound_definition text;
  uncertain_definition text;
begin
  select indexdef into unbound_definition
  from pg_indexes
  where schemaname = 'public'
    and tablename = 'payment_sessions'
    and indexname = 'idx_payment_sessions_unbound_initialization_started';

  select indexdef into uncertain_definition
  from pg_indexes
  where schemaname = 'public'
    and tablename = 'payment_sessions'
    and indexname = 'idx_payment_sessions_uncertain_initialization_started';

  if unbound_definition is null
     or unbound_definition not ilike '%payment_initialization_started_at%'
     or unbound_definition not ilike '%payment_initialization_attempt_id IS NOT NULL%'
     or unbound_definition not ilike '%provider_payment_id IS NULL%'
     or unbound_definition not ilike '%status%pending%requires_payment%' then
    raise exception 'stale-unbound reconciliation partial index lost required predicate';
  end if;

  if uncertain_definition is null
     or uncertain_definition not ilike '%payment_initialization_started_at%'
     or uncertain_definition not ilike '%payment_initialization_attempt_id IS NOT NULL%'
     or uncertain_definition not ilike '%payment_initialization_uncertain%'
     or uncertain_definition not ilike '%status%pending%requires_payment%' then
    raise exception 'uncertain reconciliation partial index lost required predicate';
  end if;
end
$$;

set local role service_role;

do $$
declare
  v_status text;
  v_stale bigint;
  v_uncertain bigint;
  v_window integer;
begin
  select status, stale_unbound_claim_count, uncertain_claim_count, stale_minutes
  into v_status, v_stale, v_uncertain, v_window
  from public.service_payment_reconciliation_health(10);

  if v_status <> 'ok' or v_stale <> 0 or v_uncertain <> 0 or v_window <> 10 then
    raise exception 'empty reconciliation health was not ok: %, %, %, %',
      v_status, v_stale, v_uncertain, v_window;
  end if;
end
$$;

reset role;

-- A recent unbound claim remains inside the grace window. A stale provider-bound
-- requires_payment session may legitimately await customer action. Terminal
-- paid/failed/cancelled sessions are not active reconciliation conditions even
-- if their historical initialization timestamp is old.
insert into public.payment_sessions(
  id, buyer_id, idempotency_key, status, amount_cents,
  payment_initialization_attempt_id, payment_initialization_started_at,
  payment_provider, provider_payment_id, metadata
)
values
  (
    'a2000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000003',
    'pending', 1000,
    'a4000000-0000-0000-0000-000000000004', now() - interval '2 minutes',
    null, null, '{}'::jsonb
  ),
  (
    'a5000000-0000-0000-0000-000000000005',
    'a1000000-0000-0000-0000-000000000001',
    'a6000000-0000-0000-0000-000000000006',
    'requires_payment', 1000,
    'a7000000-0000-0000-0000-000000000007', now() - interval '30 minutes',
    'simulator', 'sim_waiting_customer', '{}'::jsonb
  ),
  (
    'a8000000-0000-0000-0000-000000000008',
    'a1000000-0000-0000-0000-000000000001',
    'a9000000-0000-0000-0000-000000000009',
    'cancelled', 1000,
    'aa000000-0000-0000-0000-000000000010', now() - interval '30 minutes',
    null, null, '{}'::jsonb
  ),
  (
    'b1000000-0000-0000-0000-000000000017',
    'a1000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000018',
    'paid', 1000,
    'b3000000-0000-0000-0000-000000000019', now() - interval '30 minutes',
    null, null, '{}'::jsonb
  ),
  (
    'b4000000-0000-0000-0000-000000000020',
    'a1000000-0000-0000-0000-000000000001',
    'b5000000-0000-0000-0000-000000000021',
    'failed', 1000,
    'b6000000-0000-0000-0000-000000000022', now() - interval '30 minutes',
    null, null, '{}'::jsonb
  );

set local role service_role;

do $$
declare
  v_status text;
  v_stale bigint;
  v_uncertain bigint;
begin
  select status, stale_unbound_claim_count, uncertain_claim_count
  into v_status, v_stale, v_uncertain
  from public.service_payment_reconciliation_health(10);

  if v_status <> 'ok' or v_stale <> 0 or v_uncertain <> 0 then
    raise exception 'grace/provider-bound/terminal exclusions failed: %, %, %',
      v_status, v_stale, v_uncertain;
  end if;
end
$$;

reset role;

-- A claimed checkout with no provider reference past the grace period means the
-- initialization outcome is unresolved and must degrade readiness.
insert into public.payment_sessions(
  id, buyer_id, idempotency_key, status, amount_cents,
  payment_initialization_attempt_id, payment_initialization_started_at, metadata
)
values (
  'ab000000-0000-0000-0000-000000000011',
  'a1000000-0000-0000-0000-000000000001',
  'ac000000-0000-0000-0000-000000000012',
  'pending', 1000,
  'ad000000-0000-0000-0000-000000000013', now() - interval '30 minutes',
  '{}'::jsonb
);

set local role service_role;

do $$
declare
  v_status text;
  v_stale bigint;
  v_uncertain bigint;
begin
  select status, stale_unbound_claim_count, uncertain_claim_count
  into v_status, v_stale, v_uncertain
  from public.service_payment_reconciliation_health(10);

  if v_status <> 'degraded' or v_stale <> 1 or v_uncertain <> 0 then
    raise exception 'stale unbound claim was not detected: %, %, %',
      v_status, v_stale, v_uncertain;
  end if;
end
$$;

reset role;

-- Explicit uncertainty is actionable immediately, even before the stale timer.
insert into public.payment_sessions(
  id, buyer_id, idempotency_key, status, amount_cents,
  payment_initialization_attempt_id, payment_initialization_started_at, metadata
)
values (
  'ae000000-0000-0000-0000-000000000014',
  'a1000000-0000-0000-0000-000000000001',
  'af000000-0000-0000-0000-000000000015',
  'pending', 1000,
  'b0000000-0000-0000-0000-000000000016', now() - interval '1 minute',
  '{"payment_initialization_uncertain": true}'::jsonb
);

set local role service_role;

do $$
declare
  v_status text;
  v_stale bigint;
  v_uncertain bigint;
  v_min_window integer;
  v_max_window integer;
begin
  select status, stale_unbound_claim_count, uncertain_claim_count, stale_minutes
  into v_status, v_stale, v_uncertain, v_min_window
  from public.service_payment_reconciliation_health(1);

  select stale_minutes into v_max_window
  from public.service_payment_reconciliation_health(99999);

  if v_status <> 'degraded' or v_stale <> 1 or v_uncertain <> 1 then
    raise exception 'explicit uncertainty was not detected: %, %, %',
      v_status, v_stale, v_uncertain;
  end if;
  if v_min_window <> 5 or v_max_window <> 1440 then
    raise exception 'reconciliation health window bounds changed: min %, max %',
      v_min_window, v_max_window;
  end if;
end
$$;

rollback;

\echo 'EntizNetStore payment reconciliation health regression suite passed'
