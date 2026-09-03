\set ON_ERROR_STOP on

-- Trusted settlement / payout authority adversarial regression.
-- Disposable local Supabase database only; all fixtures roll back.
begin;

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('00000000-0000-0000-0000-000000000000','91000000-0000-0000-0000-000000000001','authenticated','authenticated','settlement-admin@test.invalid','',now(),'{"role":"admin"}'::jsonb,'{}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','92000000-0000-0000-0000-000000000002','authenticated','authenticated','settlement-buyer@test.invalid','',now(),'{}'::jsonb,'{}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','93000000-0000-0000-0000-000000000003','authenticated','authenticated','settlement-other@test.invalid','',now(),'{}'::jsonb,'{}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','94000000-0000-0000-0000-000000000004','authenticated','authenticated','settlement-seller@test.invalid','',now(),'{}'::jsonb,'{}'::jsonb,now(),now());

insert into public.profiles_buyer(id,display_name) values
  ('92000000-0000-0000-0000-000000000002','Settlement Buyer'),
  ('93000000-0000-0000-0000-000000000003','Other Buyer'),
  ('94000000-0000-0000-0000-000000000004','Seller Buyer Capability');
insert into public.profiles_seller(id,storefront_name,verification_status)
values ('94000000-0000-0000-0000-000000000004','Settlement Seller','verified');

insert into public.orders(
  id,order_number,buyer_id,seller_id,status,subtotal_cents,total_cents,
  payment_status,fulfillment_status,delivered_at,created_at,updated_at
) values
  ('95000000-0000-0000-0000-000000000005','ENS-SETTLE-001','92000000-0000-0000-0000-000000000002','94000000-0000-0000-0000-000000000004','delivered',1000,1000,'paid','fulfilled',now()-interval '10 days',now()-interval '11 days',now()),
  ('96000000-0000-0000-0000-000000000006','ENS-SETTLE-002','92000000-0000-0000-0000-000000000002','94000000-0000-0000-0000-000000000004','delivered',2000,2000,'paid','fulfilled',now()-interval '9 days',now()-interval '10 days',now()),
  ('97000000-0000-0000-0000-000000000007','ENS-SETTLE-003','92000000-0000-0000-0000-000000000002','94000000-0000-0000-0000-000000000004','delivered',3000,3000,'paid','fulfilled',now()-interval '8 days',now()-interval '9 days',now());

insert into public.escrow_transactions(id,order_id,seller_id,amount_cents,status,created_at,updated_at) values
  ('95100000-0000-0000-0000-000000000005','95000000-0000-0000-0000-000000000005','94000000-0000-0000-0000-000000000004',900,'held',now()-interval '10 days',now()),
  ('96100000-0000-0000-0000-000000000006','96000000-0000-0000-0000-000000000006','94000000-0000-0000-0000-000000000004',1800,'held',now()-interval '9 days',now()),
  ('97100000-0000-0000-0000-000000000007','97000000-0000-0000-0000-000000000007','94000000-0000-0000-0000-000000000004',2700,'held',now()-interval '8 days',now());

-- A trusted payout worker still cannot turn Seller-declared delivery into money
-- authority when no independent confirmation exists.
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$
begin
  begin
    perform * from public.request_seller_payout(
      '94000000-0000-0000-0000-000000000004',
      '98000000-0000-0000-0000-000000000008',
      now()
    );
    raise exception 'Seller delivery unexpectedly manufactured payout eligibility';
  exception when sqlstate 'P0001' then
    if sqlerrm not like 'No trusted settlement-confirmed escrow balance%' then raise; end if;
  end;
end
$$;

-- service_role has no direct write/read surface into the private confirmation
-- ledger; semantic authority must flow through the constrained functions.
do $$
begin
  begin
    insert into private.order_settlement_confirmations(
      order_id,buyer_id,seller_id,authority_type,confirmed_by,idempotency_key
    ) values (
      '95000000-0000-0000-0000-000000000005',
      '92000000-0000-0000-0000-000000000002',
      '94000000-0000-0000-0000-000000000004',
      'admin','91000000-0000-0000-0000-000000000001',gen_random_uuid()
    );
    raise exception 'service_role directly forged private settlement evidence';
  exception when insufficient_privilege then null;
  end;
end
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"93000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
do $$
begin
  begin
    perform public.confirm_buyer_order_receipt(
      '95000000-0000-0000-0000-000000000005',
      '98100000-0000-0000-0000-000000000008'
    );
    raise exception 'Unrelated Buyer confirmed another Buyer order';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- Seller cannot self-confirm receipt even if the same account also owns a Buyer
-- capability; authority is bound to this Order's canonical buyer_id.
select set_config('request.jwt.claim.sub','94000000-0000-0000-0000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"94000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
do $$
begin
  begin
    perform public.confirm_buyer_order_receipt(
      '95000000-0000-0000-0000-000000000005',
      '98200000-0000-0000-0000-000000000008'
    );
    raise exception 'Seller self-confirmed Buyer receipt';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- Canonical Buyer confirmation is idempotent and produces one immutable fact.
select set_config('request.jwt.claim.sub','92000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"92000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select public.confirm_buyer_order_receipt(
  '95000000-0000-0000-0000-000000000005',
  '98300000-0000-0000-0000-000000000008'
);
select public.confirm_buyer_order_receipt(
  '95000000-0000-0000-0000-000000000005',
  '98300000-0000-0000-0000-000000000008'
);

do $$
declare
  v_count integer;
  v_source text;
  v_notifications integer;
begin
  select count(*), min(authority_type) into v_count,v_source
  from private.order_settlement_confirmations
  where order_id='95000000-0000-0000-0000-000000000005';
  select count(*) into v_notifications from public.notifications
  where user_id='94000000-0000-0000-0000-000000000004'
    and metadata->>'event'='buyer_receipt_confirmed'
    and metadata->>'order_id'='95000000-0000-0000-0000-000000000005';
  if v_count<>1 or v_source<>'buyer' or v_notifications<>1 then
    raise exception 'Buyer settlement idempotency/evidence failed: %, %, %',v_count,v_source,v_notifications;
  end if;
end
$$;

-- Active dispute blocks trusted confirmation for a second Order.
reset role;
insert into public.order_disputes(
  id,order_id,raised_by,raised_by_role,reason_code,status
) values (
  '98400000-0000-0000-0000-000000000008','96000000-0000-0000-0000-000000000006',
  '92000000-0000-0000-0000-000000000002','buyer','item_not_received','open'
);
set local role authenticated;
select set_config('request.jwt.claim.sub','92000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"92000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
do $$
begin
  begin
    perform public.confirm_buyer_order_receipt(
      '96000000-0000-0000-0000-000000000006',
      '98500000-0000-0000-0000-000000000008'
    );
    raise exception 'Active dispute did not block Buyer settlement confirmation';
  exception when sqlstate '22023' then
    if sqlerrm <> 'active_order_dispute_blocks_settlement' then raise; end if;
  end;
end
$$;

-- Admin fallback rejects identity spoofing, requires a reason, and writes an
-- immutable audit record when independent delivery has been verified.
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$
begin
  begin
    perform public.admin_confirm_order_settlement(
      '93000000-0000-0000-0000-000000000003',
      '97000000-0000-0000-0000-000000000007',
      'Independent delivery evidence reviewed',
      '98600000-0000-0000-0000-000000000008'
    );
    raise exception 'Non-Admin identity created Admin settlement authority';
  exception when insufficient_privilege then null;
  end;
end
$$;

select public.admin_confirm_order_settlement(
  '91000000-0000-0000-0000-000000000001',
  '97000000-0000-0000-0000-000000000007',
  'Independent delivery evidence reviewed',
  '98700000-0000-0000-0000-000000000008'
);

do $$
declare v_source text; v_audit integer;
begin
  select authority_type into v_source from private.order_settlement_confirmations
  where order_id='97000000-0000-0000-0000-000000000007';
  select count(*) into v_audit from public.admin_audit_logs
  where admin_id='91000000-0000-0000-0000-000000000001'
    and action='order_settlement_confirmed'
    and target_id='97000000-0000-0000-0000-000000000007';
  if v_source<>'admin' or v_audit<>1 then
    raise exception 'Admin settlement evidence/audit failed: %, %',v_source,v_audit;
  end if;
end
$$;

-- The payout hold clock starts at trusted confirmation, not Seller delivered_at.
do $$
begin
  begin
    perform * from public.request_seller_payout(
      '94000000-0000-0000-0000-000000000004',
      '98800000-0000-0000-0000-000000000008',
      now()-interval '1 minute'
    );
    raise exception 'Backdated Seller delivery bypassed trusted-confirmation hold';
  exception when sqlstate 'P0001' then null;
  end;
end
$$;

-- A current cutoff may reserve the independently confirmed Orders. Order 002 is
-- disputed and therefore excluded even though Seller marked it delivered.
select * from public.request_seller_payout(
  '94000000-0000-0000-0000-000000000004',
  '98900000-0000-0000-0000-000000000008',
  now()
) \gset
select set_config('settlement.payout_id', :'payout_request_id', false);

do $$
declare v_items integer; v_amount bigint;
begin
  select count(*),coalesce(sum(amount_cents),0) into v_items,v_amount
  from public.payout_items where payout_request_id=current_setting('settlement.payout_id')::uuid;
  if v_items<>2 or v_amount<>3600 then
    raise exception 'Trusted payout reservation selected wrong escrow: items %, amount %',v_items,v_amount;
  end if;
end
$$;

select public.attach_seller_payout_provider_reference(
  current_setting('settlement.payout_id')::uuid,'simulator','po_settlement_guard'
);

-- A refund opened after reservation is a finalization blocker. The blocker write
-- and payout finalization serialize through the same Order lock.
insert into public.refund_requests(
  id,order_id,buyer_id,requested_by,requester_role,idempotency_key,
  amount_cents,currency,reason,status
) values (
  '99000000-0000-0000-0000-000000000009','95000000-0000-0000-0000-000000000005',
  '92000000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000002',
  'buyer','99100000-0000-0000-0000-000000000009',900,'usd','Post-reservation safety regression','requested'
);

do $$
begin
  begin
    perform public.finalize_seller_payout_v1(
      'simulator','evt_settlement_blocked','payout.succeeded',
      current_setting('settlement.payout_id')::uuid,
      'po_settlement_guard','succeeded'
    );
    raise exception 'Active refund did not block payout provider success';
  exception when sqlstate '22023' then
    if sqlerrm <> 'Active refund blocks payout finalization' then raise; end if;
  end;
end
$$;

do $$
declare v_held integer; v_reserved integer;
begin
  select count(*) into v_held from public.escrow_transactions
  where id in ('95100000-0000-0000-0000-000000000005','97100000-0000-0000-0000-000000000007') and status='held';
  select count(*) into v_reserved from public.payout_items
  where payout_request_id=current_setting('settlement.payout_id')::uuid and status='reserved';
  if v_held<>2 or v_reserved<>2 then
    raise exception 'Blocked payout changed money state: held %, reserved %',v_held,v_reserved;
  end if;
end
$$;

update public.refund_requests set status='cancelled',updated_at=now()
where id='99000000-0000-0000-0000-000000000009';

select public.finalize_seller_payout_v1(
  'simulator','evt_settlement_success','payout.succeeded',
  current_setting('settlement.payout_id')::uuid,
  'po_settlement_guard','succeeded'
);

do $$
declare v_released integer; v_settled integer;
begin
  select count(*) into v_released from public.escrow_transactions
  where id in ('95100000-0000-0000-0000-000000000005','97100000-0000-0000-0000-000000000007') and status='released';
  select count(*) into v_settled from public.payout_items
  where payout_request_id=current_setting('settlement.payout_id')::uuid and status='settled';
  if v_released<>2 or v_settled<>2 then
    raise exception 'Trusted payout finalization failed: released %, settled %',v_released,v_settled;
  end if;
end
$$;

-- Even the table owner cannot rewrite the trusted historical fact.
reset role;
do $$
begin
  begin
    update private.order_settlement_confirmations
    set reason='rewritten'
    where order_id='95000000-0000-0000-0000-000000000005';
    raise exception 'Settlement confirmation was mutable';
  exception when insufficient_privilege then null;
  end;
end
$$;

rollback;
select 'Trusted settlement + payout authority regression passed' as result;
