\set ON_ERROR_STOP on

-- Structural M3 release gate. This complements behavioral suites by locking the
-- production security/performance shape into every fresh database reproduction.
-- Later milestones may add public tables, but they may not remove the M3/P0
-- baseline and every public table must remain RLS-protected.

do $$
declare
  v_public_tables integer;
  v_rls_tables integer;
  v_missing_indexes text[];
  v_policy_uses_private boolean;
begin
  select count(*) into v_public_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r';

  select count(*) into v_rls_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity;

  if v_public_tables < 46 or v_rls_tables <> v_public_tables then
    raise exception 'M3/P0 public-table/RLS invariant failed: tables %, RLS %',
      v_public_tables, v_rls_tables;
  end if;

  if to_regclass('public.carts') is null
     or to_regclass('public.cart_items') is null
     or to_regclass('public.cart_quotes') is null
     or to_regclass('public.marketplace_capability_states') is null
     or to_regclass('public.marketplace_capability_state_events') is null
     or to_regclass('public.entiznet_identity_links') is null
     or to_regclass('public.entiznet_handoff_events') is null
     or to_regclass('public.order_disputes') is null
     or to_regclass('public.order_dispute_events') is null
     or to_regclass('public.refund_requests') is null
     or to_regclass('public.refund_provider_events') is null
     or to_regclass('public.marketplace_reports') is null
     or to_regclass('public.prohibited_product_rules') is null
     or to_regclass('public.upload_scan_jobs') is null then
    raise exception 'One or more required M3/P0 tables are missing';
  end if;

  select array_agg(required.name order by required.name)
    into v_missing_indexes
  from (values
    ('idx_cart_items_product_id'),
    ('idx_marketplace_capability_state_events_actor_id'),
    ('idx_marketplace_capability_states_restored_by'),
    ('idx_marketplace_capability_states_suspended_by'),
    ('idx_order_dispute_events_actor_id'),
    ('idx_order_disputes_assigned_admin_id'),
    ('idx_prohibited_product_rules_created_by'),
    ('idx_prohibited_product_rules_updated_by'),
    ('idx_refund_requests_dispute_id'),
    ('idx_refund_requests_requested_by'),
    ('idx_refund_requests_reviewed_by')
  ) required(name)
  where to_regclass('public.' || required.name) is null;

  if v_missing_indexes is not null then
    raise exception 'Missing M3 advisor indexes: %', v_missing_indexes;
  end if;

  if to_regprocedure('app_private.marketplace_capability_is_active(uuid,text)') is null then
    raise exception 'Non-exposed M3 capability RLS helper is missing';
  end if;

  if has_function_privilege('anon', 'public.marketplace_capability_is_active(uuid,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.marketplace_capability_is_active(uuid,text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.marketplace_capability_is_active(uuid,text)', 'EXECUTE') then
    raise exception 'Public capability helper browser execution boundary is incorrect';
  end if;

  if not has_schema_privilege('anon', 'app_private', 'USAGE')
     or not has_schema_privilege('authenticated', 'app_private', 'USAGE')
     or not has_function_privilege('anon', 'app_private.marketplace_capability_is_active(uuid,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'app_private.marketplace_capability_is_active(uuid,text)', 'EXECUTE') then
    raise exception 'Private capability RLS helper execution boundary is incorrect';
  end if;

  select coalesce(qual like '%app_private.marketplace_capability_is_active%', false)
    into v_policy_uses_private
  from pg_policies
  where schemaname = 'public'
    and tablename = 'products'
    and policyname = 'products_anon_select';

  if not coalesce(v_policy_uses_private, false) then
    raise exception 'Anonymous product policy is not using the private capability helper';
  end if;

  if has_function_privilege('authenticated', 'public.create_checkout_session(jsonb,jsonb,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.create_checkout_session(jsonb,jsonb,uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.create_checkout_session(jsonb,jsonb,uuid)', 'EXECUTE') then
    raise exception 'Legacy checkout execution boundary is incorrect';
  end if;

  if not has_function_privilege('authenticated', 'public.create_checkout_session_v2(uuid,uuid,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.create_checkout_session_v2(uuid,uuid,uuid)', 'EXECUTE') then
    raise exception 'Checkout v2 execution boundary is incorrect';
  end if;
end
$$;

select 'M3 structural database invariants verified' as result;
