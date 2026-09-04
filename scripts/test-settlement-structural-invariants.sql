\set ON_ERROR_STOP on

-- Trusted settlement authority structural/privilege contract.
-- This suite complements the adversarial money-flow regression by proving the
-- hidden table, callable surfaces and search paths cannot silently drift.
do $$
declare
  v_definition text;
  v_path text[];
begin
  if to_regclass('private.order_settlement_confirmations') is null then
    raise exception 'hidden settlement confirmation table missing';
  end if;

  if has_table_privilege('anon','private.order_settlement_confirmations','SELECT')
     or has_table_privilege('authenticated','private.order_settlement_confirmations','SELECT')
     or has_table_privilege('service_role','private.order_settlement_confirmations','SELECT')
     or has_table_privilege('anon','private.order_settlement_confirmations','INSERT')
     or has_table_privilege('authenticated','private.order_settlement_confirmations','INSERT')
     or has_table_privilege('service_role','private.order_settlement_confirmations','INSERT')
     or has_table_privilege('authenticated','private.order_settlement_confirmations','UPDATE')
     or has_table_privilege('service_role','private.order_settlement_confirmations','UPDATE')
     or has_table_privilege('authenticated','private.order_settlement_confirmations','DELETE')
     or has_table_privilege('service_role','private.order_settlement_confirmations','DELETE') then
    raise exception 'settlement confirmation table leaked direct API-role privileges';
  end if;

  if has_function_privilege('anon','public.confirm_buyer_order_receipt(uuid,uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.confirm_buyer_order_receipt(uuid,uuid)','EXECUTE') then
    raise exception 'buyer receipt public wrapper privilege contract changed';
  end if;
  if has_function_privilege('anon','public.get_order_settlement_confirmation(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.get_order_settlement_confirmation(uuid)','EXECUTE') then
    raise exception 'settlement read wrapper privilege contract changed';
  end if;
  if has_function_privilege('anon','public.admin_confirm_order_settlement(uuid,uuid,text,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.admin_confirm_order_settlement(uuid,uuid,text,uuid)','EXECUTE')
     or not has_function_privilege('service_role','public.admin_confirm_order_settlement(uuid,uuid,text,uuid)','EXECUTE') then
    raise exception 'Admin settlement wrapper privilege contract changed';
  end if;

  if has_function_privilege('anon','private.confirm_buyer_order_receipt(uuid,uuid)','EXECUTE')
     or not has_function_privilege('authenticated','private.confirm_buyer_order_receipt(uuid,uuid)','EXECUTE')
     or has_function_privilege('service_role','private.confirm_buyer_order_receipt(uuid,uuid)','EXECUTE') then
    raise exception 'hidden Buyer settlement authority privilege contract changed';
  end if;
  if has_function_privilege('anon','private.get_order_settlement_confirmation(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','private.get_order_settlement_confirmation(uuid)','EXECUTE')
     or has_function_privilege('service_role','private.get_order_settlement_confirmation(uuid)','EXECUTE') then
    raise exception 'hidden settlement reader privilege contract changed';
  end if;
  if has_function_privilege('anon','private.confirm_admin_order_settlement(uuid,uuid,text,uuid)','EXECUTE')
     or has_function_privilege('authenticated','private.confirm_admin_order_settlement(uuid,uuid,text,uuid)','EXECUTE')
     or not has_function_privilege('service_role','private.confirm_admin_order_settlement(uuid,uuid,text,uuid)','EXECUTE') then
    raise exception 'hidden Admin settlement authority privilege contract changed';
  end if;

  if has_function_privilege('anon','public.request_seller_payout(uuid,uuid,timestamp with time zone)','EXECUTE')
     or has_function_privilege('authenticated','public.request_seller_payout(uuid,uuid,timestamp with time zone)','EXECUTE')
     or not has_function_privilege('service_role','public.request_seller_payout(uuid,uuid,timestamp with time zone)','EXECUTE') then
    raise exception 'payout reservation privilege contract changed';
  end if;
  if has_function_privilege('anon','public.finalize_seller_payout_v1(text,text,text,uuid,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.finalize_seller_payout_v1(text,text,text,uuid,text,text)','EXECUTE')
     or not has_function_privilege('service_role','public.finalize_seller_payout_v1(text,text,text,uuid,text,text)','EXECUTE') then
    raise exception 'payout finalization privilege contract changed';
  end if;

  select p.proconfig into v_path
  from pg_proc p
  where p.oid='public.confirm_buyer_order_receipt(uuid,uuid)'::regprocedure;
  if not ('search_path=pg_catalog, public' = any(coalesce(v_path,array[]::text[]))) then
    raise exception 'buyer receipt wrapper lost approved hardened search_path';
  end if;

  select p.proconfig into v_path
  from pg_proc p
  where p.oid='public.admin_confirm_order_settlement(uuid,uuid,text,uuid)'::regprocedure;
  if not ('search_path=pg_catalog, public, auth' = any(coalesce(v_path,array[]::text[]))) then
    raise exception 'Admin settlement wrapper lost approved hardened search_path';
  end if;

  foreach v_definition in array array[
    pg_get_functiondef('private.confirm_buyer_order_receipt(uuid,uuid)'::regprocedure::oid),
    pg_get_functiondef('private.get_order_settlement_confirmation(uuid)'::regprocedure::oid),
    pg_get_functiondef('private.confirm_admin_order_settlement(uuid,uuid,text,uuid)'::regprocedure::oid)
  ] loop
    if v_definition not ilike '%security definer%'
       or v_definition not ilike '%set search_path to ''''%' then
      raise exception 'hidden settlement authority lost SECURITY DEFINER/empty search_path hardening';
    end if;
  end loop;

  select pg_get_functiondef('private.confirm_buyer_order_receipt(uuid,uuid)'::regprocedure::oid)
    into v_definition;
  if v_definition not ilike '%auth.uid()%'
     or v_definition not ilike '%v_order.buyer_id <> v_actor%'
     or v_definition not ilike '%insert into public.notifications%'
     or v_definition ilike '%title, body%'
     or v_definition not ilike '%message,%' then
    raise exception 'Buyer settlement authority lost actor binding or canonical notification contract';
  end if;

  select pg_get_functiondef('public.request_seller_payout(uuid,uuid,timestamp with time zone)'::regprocedure::oid)
    into v_definition;
  if v_definition not ilike '%private.order_settlement_confirmations%'
     or v_definition not ilike '%c.confirmed_at <= p_eligible_before%'
     or v_definition not ilike '%refund_requests%'
     or v_definition not ilike '%order_disputes%' then
    raise exception 'payout reservation lost independent settlement/refund/dispute authority';
  end if;

  select pg_get_functiondef('public.finalize_seller_payout_v1(text,text,text,uuid,text,text)'::regprocedure::oid)
    into v_definition;
  if v_definition not ilike '%private.order_settlement_confirmations%'
     or v_definition not ilike '%for update%'
     or v_definition not ilike '%refund_requests%'
     or v_definition not ilike '%order_disputes%'
     or v_definition not ilike '%status=''released''%' then
    raise exception 'payout finalization lost settlement revalidation or escrow release authority';
  end if;
end
$$;

select 'Trusted settlement structural invariants verified' as result;
