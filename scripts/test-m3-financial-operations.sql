\set ON_ERROR_STOP on

-- Combined M3 finance/admin regression suite. Disposable CI database only.
begin;

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('00000000-0000-0000-0000-000000000000','fa000000-0000-0000-0000-000000000001','authenticated','authenticated','finance-admin@test.invalid','',now(),'{"role":"admin"}'::jsonb,'{}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','fb000000-0000-0000-0000-000000000002','authenticated','authenticated','finance-buyer@test.invalid','',now(),'{}'::jsonb,'{}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','fc000000-0000-0000-0000-000000000003','authenticated','authenticated','finance-seller@test.invalid','',now(),'{}'::jsonb,'{}'::jsonb,now(),now());

insert into public.profiles_buyer(id,display_name) values
  ('fb000000-0000-0000-0000-000000000002','Finance Buyer'),
  ('fc000000-0000-0000-0000-000000000003','Finance Seller Buyer Baseline');
insert into public.profiles_seller(id,storefront_name,verification_status,return_policy,shipping_policy)
values ('fc000000-0000-0000-0000-000000000003','Finance Seller','verified','Returns policy','Shipping policy');

-- Order 001 is intentionally partially refunded. It exercises GMV/refund/revenue
-- reporting and must NOT be eligible for Seller payout.
insert into public.orders(
  id,order_number,buyer_id,seller_id,status,subtotal_cents,total_cents,
  payment_status,fulfillment_status,delivered_at,metadata,created_at,updated_at
) values (
  'fd000000-0000-0000-0000-000000000004','ENS-FINANCE-001',
  'fb000000-0000-0000-0000-000000000002','fc000000-0000-0000-0000-000000000003',
  'delivered',10000,10000,'partially_refunded','fulfilled',now()-interval '10 days',
  jsonb_build_object('platform_fee_cents',1000,'refunded_cents',2000,'seller_refunded_cents',1800,'platform_fee_refunded_cents',200),
  now()-interval '11 days',now()
);

-- Order 002 is a separate fully-paid delivered order. Its held escrow becomes
-- payout eligible only after independent Admin settlement confirmation below.
insert into public.orders(
  id,order_number,buyer_id,seller_id,status,subtotal_cents,total_cents,
  payment_status,fulfillment_status,delivered_at,metadata,created_at,updated_at
) values (
  'fd100000-0000-0000-0000-000000000009','ENS-FINANCE-002',
  'fb000000-0000-0000-0000-000000000002','fc000000-0000-0000-0000-000000000003',
  'delivered',7200,7200,'paid','fulfilled',now()-interval '10 days',
  jsonb_build_object('platform_fee_cents',720),
  now()-interval '11 days',now()
);

insert into public.escrow_transactions(
  id,order_id,seller_id,amount_cents,status,created_at,updated_at
) values (
  'fe000000-0000-0000-0000-000000000005','fd100000-0000-0000-0000-000000000009',
  'fc000000-0000-0000-0000-000000000003',7200,'held',now()-interval '10 days',now()
);

insert into public.refund_requests(
  id,order_id,buyer_id,requested_by,requester_role,idempotency_key,
  amount_cents,currency,reason,status,payment_provider,provider_refund_id,
  created_at,updated_at,completed_at
) values (
  'ff000000-0000-0000-0000-000000000006','fd000000-0000-0000-0000-000000000004',
  'fb000000-0000-0000-0000-000000000002','fb000000-0000-0000-0000-000000000002',
  'buyer','ff100000-0000-0000-0000-000000000007',2000,'usd','Finance regression refund',
  'succeeded','simulator','rf_finance_1',now()-interval '2 days',now()-interval '2 days',now()-interval '2 days'
);

-- Trusted functions must never be browser executable.
do $$
declare v_fn text;
begin
  foreach v_fn in array array[
    'public.admin_get_financial_operations_summary(uuid)',
    'public.admin_search_financial_transactions(uuid,text,text,text,integer,integer)',
    'public.admin_search_payout_requests(uuid,text,text,integer,integer)',
    'public.admin_search_escrow_transactions(uuid,text,text,integer,integer)',
    'public.admin_search_audit_logs(uuid,text,text,integer,integer)',
    'public.admin_create_seller_payout(uuid,uuid,uuid,timestamp with time zone)',
    'public.admin_cancel_seller_payout(uuid,uuid,text)',
    'public.admin_confirm_order_settlement(uuid,uuid,text,uuid)'
  ] loop
    if has_function_privilege('anon',v_fn,'EXECUTE')
       or has_function_privilege('authenticated',v_fn,'EXECUTE')
       or not has_function_privilege('service_role',v_fn,'EXECUTE') then
      raise exception 'Finance Admin RPC privilege boundary failed for %', v_fn;
    end if;
  end loop;
  if to_regclass('public.idx_admin_audit_logs_target') is null
     or to_regclass('public.idx_escrow_transactions_status_created') is null then
    raise exception 'Finance operations supporting indexes are missing';
  end if;
end
$$;

set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);

-- A service-role caller cannot impersonate a non-Admin ID.
do $$
begin
  begin
    perform public.admin_get_financial_operations_summary('fb000000-0000-0000-0000-000000000002');
    raise exception 'Non-Admin identity unexpectedly used finance Admin RPC';
  exception when insufficient_privilege then null;
  end;
end
$$;

select set_config(
  'm3finance.summary',
  public.admin_get_financial_operations_summary('fa000000-0000-0000-0000-000000000001')::text,
  false
);

do $$
declare v jsonb := current_setting('m3finance.summary')::jsonb;
begin
  if (v->>'grossSalesCents')::bigint <> 17200
     or (v->>'customerRefundedCents')::bigint <> 2000
     or (v->>'netGmvCents')::bigint <> 15200
     or (v->>'grossPlatformRevenueCents')::bigint <> 1720
     or (v->>'platformRevenueRefundedCents')::bigint <> 200
     or (v->>'netPlatformRevenueCents')::bigint <> 1520
     or (v->>'escrowHeldCents')::bigint <> 7200
     or (v->>'paidOrders')::integer <> 2 then
    raise exception 'Finance summary math incorrect: %', v;
  end if;
end
$$;

-- Seller-declared delivery is not enough. The finance Admin must first create
-- independently audited settlement evidence before payout preparation can see
-- this Order as eligible.
select public.admin_confirm_order_settlement(
  'fa000000-0000-0000-0000-000000000001',
  'fd100000-0000-0000-0000-000000000009',
  'Finance regression independently verified delivery',
  'ff150000-0000-0000-0000-000000000007'
);

-- Prepare payout through the Admin wrapper. It must reserve only independently
-- confirmed held escrow and produce an immutable Admin audit event.
select * from public.admin_create_seller_payout(
  'fa000000-0000-0000-0000-000000000001',
  'fc000000-0000-0000-0000-000000000003',
  'ff200000-0000-0000-0000-000000000008',
  now()
) \gset
select set_config('m3finance.payout_request_id', :'payout_request_id', false);
select set_config('m3finance.amount_cents', :'amount_cents', false);
select set_config('m3finance.payout_status', :'payout_status', false);

do $$
declare
  v_payout_request_id uuid := current_setting('m3finance.payout_request_id')::uuid;
  v_items integer;
  v_audit integer;
  v_settlement_audit integer;
begin
  if current_setting('m3finance.amount_cents')::bigint <> 7200
     or current_setting('m3finance.payout_status') <> 'pending' then
    raise exception 'Admin payout preparation returned wrong amount/status';
  end if;
  select count(*) into v_items from public.payout_items
  where payout_request_id=v_payout_request_id and status='reserved';
  select count(*) into v_audit from public.admin_audit_logs
  where action='seller_payout_prepared' and target_id=v_payout_request_id::text;
  select count(*) into v_settlement_audit from public.admin_audit_logs
  where action='order_settlement_confirmed' and target_id='fd100000-0000-0000-0000-000000000009';
  if v_items<>1 or v_audit<>1 or v_settlement_audit<>1 then
    raise exception 'Admin payout reservation/settlement audit failed';
  end if;
end
$$;

-- Unified transaction search must find canonical refund, payout and escrow rows
-- across both finance fixture orders.
do $$
declare
  v_types text[];
begin
  select array_agg(distinct transaction_type order by transaction_type) into v_types
  from public.admin_search_financial_transactions(
    'fa000000-0000-0000-0000-000000000001','ENS-FINANCE','all','all',100,0
  );
  if not (v_types @> array['escrow','refund','payout']::text[]) then
    raise exception 'Global transaction search missing finance ledger types: %', v_types;
  end if;
end
$$;

-- Payout and escrow queues expose the same canonical claim relationship.
do $$
declare
  v_payout_request_id uuid := current_setting('m3finance.payout_request_id')::uuid;
  v_payouts integer;
  v_escrow integer;
begin
  select count(*) into v_payouts from public.admin_search_payout_requests(
    'fa000000-0000-0000-0000-000000000001','finance-seller','pending',50,0
  );
  select count(*) into v_escrow from public.admin_search_escrow_transactions(
    'fa000000-0000-0000-0000-000000000001','ENS-FINANCE-002','held',50,0
  ) where payout_request_id=v_payout_request_id;
  if v_payouts<>1 or v_escrow<>1 then raise exception 'Payout/escrow Admin read model failed'; end if;
end
$$;

-- Cancellation releases the claim but never releases Seller escrow itself.
select public.admin_cancel_seller_payout(
  'fa000000-0000-0000-0000-000000000001',
  current_setting('m3finance.payout_request_id')::uuid,
  'Finance regression cancellation'
);

do $$
declare
  v_payout_request_id uuid := current_setting('m3finance.payout_request_id')::uuid;
  v_status text;
  v_item_status text;
  v_escrow_status text;
  v_audit integer;
begin
  select status into v_status from public.payout_requests where id=v_payout_request_id;
  select status into v_item_status from public.payout_items where payout_request_id=v_payout_request_id;
  select status into v_escrow_status from public.escrow_transactions where id='fe000000-0000-0000-0000-000000000005';
  select count(*) into v_audit from public.admin_audit_logs
  where action='seller_payout_cancelled' and target_id=v_payout_request_id::text;
  if v_status<>'cancelled' or v_item_status<>'released' or v_escrow_status<>'held' or v_audit<>1 then
    raise exception 'Payout cancellation state/audit failed: %, %, %, %',v_status,v_item_status,v_escrow_status,v_audit;
  end if;
end
$$;

-- Audit search itself must surface the trusted lifecycle events.
do $$
declare v_count integer;
begin
  select count(*) into v_count from public.admin_search_audit_logs(
    'fa000000-0000-0000-0000-000000000001','payout','all',100,0
  );
  if v_count < 2 then raise exception 'Audit search did not expose payout lifecycle events'; end if;
end
$$;

rollback;
select 'M3 financial operations regression suite passed' as result;
