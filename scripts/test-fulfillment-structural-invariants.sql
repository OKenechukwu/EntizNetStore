\set ON_ERROR_STOP on

-- Structural proof for the atomic fulfillment authority.
do $$
declare
  v_public_definer boolean;
  v_private_definer boolean;
  v_private_definition text;
  v_policy_count integer;
  v_trigger_count integer;
begin
  if to_regclass('public.order_fulfillment_events') is null then
    raise exception 'order_fulfillment_events table missing';
  end if;

  select p.prosecdef into v_public_definer
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'transition_seller_order'
    and pg_get_function_identity_arguments(p.oid) = 'p_order_id uuid, p_next_status text, p_tracking_number text, p_shipping_carrier text';
  if v_public_definer is distinct from false then
    raise exception 'public transition wrapper must be SECURITY INVOKER';
  end if;

  select p.prosecdef, pg_get_functiondef(p.oid)
    into v_private_definer, v_private_definition
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app_private' and p.proname = 'transition_seller_order_authoritative';
  if v_private_definer is distinct from true then
    raise exception 'private fulfillment authority must be SECURITY DEFINER';
  end if;
  if position('SET search_path TO ''''' in v_private_definition) = 0 then
    raise exception 'private fulfillment authority must pin an empty search_path';
  end if;
  if v_private_definition ~* 'update[[:space:]]+public\.escrow_transactions'
     or v_private_definition ~* 'delete[[:space:]]+from[[:space:]]+public\.escrow_transactions' then
    raise exception 'fulfillment authority must never release or mutate escrow';
  end if;
  if v_private_definition not ilike '%bool_or(coalesce(oi.requires_shipping, true))%'
     or v_private_definition not ilike '%shipping_not_required_for_order%'
     or v_private_definition not ilike '%v_order.status = ''processing'' and not v_requires_shipping%' then
    raise exception 'digital-only fulfillment branch is missing or no longer item-derived';
  end if;

  if has_function_privilege('anon', 'public.transition_seller_order(uuid,text,text,text)', 'EXECUTE') then
    raise exception 'anon can execute public fulfillment wrapper';
  end if;
  if has_function_privilege('anon', 'app_private.transition_seller_order_authoritative(uuid,text,text,text)', 'EXECUTE') then
    raise exception 'anon can execute private fulfillment authority';
  end if;
  if not has_function_privilege('authenticated', 'public.transition_seller_order(uuid,text,text,text)', 'EXECUTE') then
    raise exception 'authenticated seller cannot execute public fulfillment wrapper';
  end if;

  if not (select relrowsecurity from pg_class where oid='public.order_fulfillment_events'::regclass) then
    raise exception 'order_fulfillment_events RLS must be enabled';
  end if;

  select count(*) into v_policy_count from pg_policies
  where schemaname='public' and tablename='order_fulfillment_events'
    and policyname='order_fulfillment_events_participant_select';
  if v_policy_count <> 1 then
    raise exception 'participant timeline RLS policy missing';
  end if;

  if has_table_privilege('anon', 'public.order_fulfillment_events', 'SELECT') then
    raise exception 'anon has timeline SELECT privilege';
  end if;
  if not has_table_privilege('authenticated', 'public.order_fulfillment_events', 'SELECT')
     or not has_table_privilege('service_role', 'public.order_fulfillment_events', 'SELECT') then
    raise exception 'authenticated/service roles need read-only timeline SELECT privilege';
  end if;

  if has_table_privilege('authenticated', 'public.order_fulfillment_events', 'INSERT')
     or has_table_privilege('authenticated', 'public.order_fulfillment_events', 'UPDATE')
     or has_table_privilege('authenticated', 'public.order_fulfillment_events', 'DELETE')
     or has_table_privilege('authenticated', 'public.order_fulfillment_events', 'TRUNCATE') then
    raise exception 'authenticated users must not mutate fulfillment events directly';
  end if;

  if has_table_privilege('service_role', 'public.order_fulfillment_events', 'INSERT')
     or has_table_privilege('service_role', 'public.order_fulfillment_events', 'UPDATE')
     or has_table_privilege('service_role', 'public.order_fulfillment_events', 'DELETE')
     or has_table_privilege('service_role', 'public.order_fulfillment_events', 'TRUNCATE') then
    raise exception 'service_role must not forge, change, erase or truncate fulfillment evidence';
  end if;

  select count(*) into v_trigger_count
  from pg_trigger
  where tgrelid='public.order_fulfillment_events'::regclass
    and tgname='trg_order_fulfillment_events_immutable'
    and not tgisinternal;
  if v_trigger_count <> 1 then
    raise exception 'fulfillment event immutability trigger missing';
  end if;
end
$$;

select 'Fulfillment authority structural invariants passed' as result;
