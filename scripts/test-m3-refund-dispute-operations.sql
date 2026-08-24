\set ON_ERROR_STOP on

-- Combined M3 refund/dispute financial regression suite.
-- Runs against the disposable fresh Supabase CI database and rolls back.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'd1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'm3-refund-buyer@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd2000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'm3-refund-seller@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd3000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'm3-refund-other@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd4000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'm3-refund-admin@test.invalid', '', now(), '{"role":"admin"}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd5000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'm3-refund-seller2@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles_buyer(id, display_name)
values
  ('d1000000-0000-0000-0000-000000000001', 'M3 Refund Buyer'),
  ('d3000000-0000-0000-0000-000000000003', 'M3 Other Buyer');

insert into public.profiles_seller(id, storefront_name, verification_status)
values
  ('d2000000-0000-0000-0000-000000000002', 'M3 Refund Seller', 'verified'),
  ('d5000000-0000-0000-0000-000000000005', 'M3 Payout Claimed Seller', 'verified');

insert into public.orders(
  id, order_number, buyer_id, seller_id, status,
  subtotal_cents, tax_cents, shipping_cents, discount_cents, total_cents,
  payment_status, fulfillment_status, delivered_at, metadata, created_at, updated_at
)
values
  (
    'e1000000-0000-0000-0000-000000000001', 'ENS-M3-REFUND-001',
    'd1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002',
    'delivered', 10000, 0, 0, 0, 10000,
    'paid', 'fulfilled', now() - interval '10 days',
    '{"platform_fee_cents":1000}'::jsonb,
    now() - interval '11 days', now()
  ),
  (
    'e2000000-0000-0000-0000-000000000002', 'ENS-M3-REFUND-002',
    'd1000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000005',
    'delivered', 2000, 0, 0, 0, 2000,
    'paid', 'fulfilled', now() - interval '10 days',
    '{"platform_fee_cents":200}'::jsonb,
    now() - interval '11 days', now()
  );

insert into public.escrow_transactions(
  id, order_id, seller_id, amount_cents, status, created_at, updated_at
)
values
  ('f1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 9000, 'held', now() - interval '10 days', now()),
  ('f2000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000002', 'd5000000-0000-0000-0000-000000000005', 1800, 'held', now() - interval '10 days', now());

-- Browser roles can use participant workflows but cannot execute Admin/provider
-- finalization functions or write operational ledgers directly.
do $$
begin
  if has_function_privilege('authenticated','public.admin_review_refund_request(uuid,uuid,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.admin_transition_order_dispute(uuid,uuid,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.finalize_refund_v1(text,text,uuid,text,text,text,text,text)','EXECUTE') then
    raise exception 'Authenticated role can execute trusted refund/dispute Admin/provider RPC';
  end if;
  if not has_function_privilege('authenticated','public.open_order_dispute(uuid,text,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.buyer_request_order_refund(uuid,bigint,text,uuid)','EXECUTE') then
    raise exception 'Participant refund/dispute RPC is not authenticated-executable';
  end if;
end
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

do $$
begin
  begin
    insert into public.order_disputes(order_id,raised_by,raised_by_role,reason_code)
    values ('e1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001','buyer','other');
    raise exception 'Buyer unexpectedly wrote dispute table directly';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.refund_requests(
      order_id,buyer_id,requested_by,requester_role,amount_cents,reason
    ) values (
      'e1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001',
      'd1000000-0000-0000-0000-000000000001','buyer',1000,'bypass'
    );
    raise exception 'Buyer unexpectedly wrote refund table directly';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- A nonparticipant cannot open a dispute on the order.
select set_config('request.jwt.claim.sub', 'd3000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"d3000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.open_order_dispute(
      'e1000000-0000-0000-0000-000000000001', 'other', 'I do not own this order'
    );
    raise exception 'Nonparticipant unexpectedly opened a dispute';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- Buyer opens dispute. Held escrow is immediately marked disputed, which makes
-- it ineligible for a Seller payout request.
select set_config('request.jwt.claim.sub', 'd1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select public.open_order_dispute(
  'e1000000-0000-0000-0000-000000000001',
  'item_not_as_described',
  'Buyer says the delivered item materially differs from the listing.'
) as dispute_id \gset
select set_config('m3refund.dispute_id', :'dispute_id', false);

reset role;
do $$
begin
  if (select dispute_id from public.escrow_transactions where id='f1000000-0000-0000-0000-000000000001')
       is distinct from current_setting('m3refund.dispute_id')::uuid then
    raise exception 'Dispute did not freeze the order escrow';
  end if;
  if (select count(*) from public.order_dispute_events where dispute_id=current_setting('m3refund.dispute_id')::uuid and action='opened') <> 1 then
    raise exception 'Dispute opening event was not recorded';
  end if;
end
$$;

set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
begin
  begin
    perform * from public.request_seller_payout(
      'd2000000-0000-0000-0000-000000000002',
      'aa000000-0000-0000-0000-000000000001',
      now() - interval '7 days'
    );
    raise exception 'Disputed escrow unexpectedly became payout-eligible';
  exception when sqlstate 'P0001' then null;
  end;
end
$$;

-- Admin accepts the case for review and resolves for Buyer. Escrow remains
-- frozen until a trusted provider refund succeeds.
select public.admin_transition_order_dispute(
  'd4000000-0000-0000-0000-000000000004',
  :'dispute_id'::uuid,
  'under_review',
  'Evidence is being reviewed.'
);
select public.admin_transition_order_dispute(
  'd4000000-0000-0000-0000-000000000004',
  :'dispute_id'::uuid,
  'resolved_buyer',
  'Evidence supports a customer refund.'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- First request is a 50% refund and is idempotent on Buyer + key.
select public.buyer_request_order_refund(
  'e1000000-0000-0000-0000-000000000001',
  5000,
  'Partial refund requested after dispute resolution.',
  'ab000000-0000-0000-0000-000000000001'
) as refund_one_id \gset
select set_config('m3refund.refund_one_id', :'refund_one_id', false);
select public.buyer_request_order_refund(
  'e1000000-0000-0000-0000-000000000001',
  5000,
  'Idempotent retry should return the same request.',
  'ab000000-0000-0000-0000-000000000001'
) as refund_one_replay_id \gset
select set_config('m3refund.refund_one_replay_id', :'refund_one_replay_id', false);

do $$
begin
  if current_setting('m3refund.refund_one_id') <> current_setting('m3refund.refund_one_replay_id') then
    raise exception 'Refund request idempotency failed';
  end if;
  begin
    perform public.buyer_request_order_refund(
      'e1000000-0000-0000-0000-000000000001',
      10001,
      'Over-refund attempt',
      'ab000000-0000-0000-0000-000000000002'
    );
    raise exception 'Refund above remaining order total was accepted';
  exception when sqlstate '22023' then null;
  end;
end
$$;

reset role;
set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select public.admin_review_refund_request(
  'd4000000-0000-0000-0000-000000000004',
  :'refund_one_id'::uuid,
  'approved',
  'Approved for provider execution.'
);
select public.attach_refund_provider_reference(
  :'refund_one_id'::uuid,
  'simulator',
  'rf_m3_partial_1'
);
select public.finalize_refund_v1(
  'evt_m3_refund_partial_1',
  'refund.succeeded',
  :'refund_one_id'::uuid,
  'simulator',
  'rf_m3_partial_1',
  'succeeded',
  null,
  null
) as refund_one_finalized \gset

reset role;
do $$
declare
  v_payment_status text;
  v_order_status text;
  v_escrow_amount bigint;
  v_escrow_status text;
  v_dispute_id uuid;
  v_refund_status text;
  v_refunded bigint;
  v_seller_refunded bigint;
  v_platform_refunded bigint;
begin
  select payment_status,status,
         (metadata->>'refunded_cents')::bigint,
         (metadata->>'seller_refunded_cents')::bigint,
         (metadata->>'platform_fee_refunded_cents')::bigint
  into v_payment_status,v_order_status,v_refunded,v_seller_refunded,v_platform_refunded
  from public.orders where id='e1000000-0000-0000-0000-000000000001';

  select amount_cents,status,dispute_id into v_escrow_amount,v_escrow_status,v_dispute_id
  from public.escrow_transactions where id='f1000000-0000-0000-0000-000000000001';
  select status into v_refund_status from public.refund_requests where id=current_setting('m3refund.refund_one_id')::uuid;

  if v_payment_status <> 'partially_refunded' or v_order_status <> 'delivered'
     or v_escrow_amount <> 4500 or v_escrow_status <> 'held'
     or v_refund_status <> 'succeeded'
     or v_refunded <> 5000 or v_seller_refunded <> 4500 or v_platform_refunded <> 500
     or v_dispute_id is not null
     or (select status from public.order_disputes where id=current_setting('m3refund.dispute_id')::uuid) <> 'closed' then
    raise exception 'Partial refund accounting/state failed: payment %, order %, escrow %/%, refund %, refunded %, seller %, platform %, dispute %',
      v_payment_status,v_order_status,v_escrow_amount,v_escrow_status,v_refund_status,v_refunded,v_seller_refunded,v_platform_refunded,v_dispute_id;
  end if;
end
$$;

-- Provider event replay must be a no-op and must not reverse money twice.
set local role service_role;
select public.finalize_refund_v1(
  'evt_m3_refund_partial_1',
  'refund.succeeded',
  :'refund_one_id'::uuid,
  'simulator',
  'rf_m3_partial_1',
  'succeeded',
  null,
  null
) as replay_result \gset
select set_config('m3refund.replay_result', :'replay_result', false);
reset role;
do $$
begin
  if current_setting('m3refund.replay_result')::boolean then
    raise exception 'Refund provider event replay was processed twice';
  end if;
  if (select amount_cents from public.escrow_transactions where id='f1000000-0000-0000-0000-000000000001') <> 4500 then
    raise exception 'Refund replay changed escrow twice';
  end if;
end
$$;

-- A second refund can consume the exact remaining amount. Full refund must end
-- with zero Seller escrow and the full recorded platform fee reversed.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select public.buyer_request_order_refund(
  'e1000000-0000-0000-0000-000000000001',
  5000,
  'Refund the remaining paid amount.',
  'ab000000-0000-0000-0000-000000000003'
) as refund_two_id \gset
select set_config('m3refund.refund_two_id', :'refund_two_id', false);

reset role;
set local role service_role;
select public.admin_review_refund_request(
  'd4000000-0000-0000-0000-000000000004',
  :'refund_two_id'::uuid,
  'approved',
  'Approve remaining refund.'
);
select public.attach_refund_provider_reference(
  :'refund_two_id'::uuid,
  'simulator',
  'rf_m3_full_2'
);
select public.finalize_refund_v1(
  'evt_m3_refund_full_2',
  'refund.succeeded',
  :'refund_two_id'::uuid,
  'simulator',
  'rf_m3_full_2',
  'succeeded',
  null,
  null
);

reset role;
do $$
declare
  v_order public.orders%rowtype;
  v_escrow public.escrow_transactions%rowtype;
begin
  select * into v_order from public.orders where id='e1000000-0000-0000-0000-000000000001';
  select * into v_escrow from public.escrow_transactions where id='f1000000-0000-0000-0000-000000000001';

  if v_order.status <> 'refunded' or v_order.payment_status <> 'refunded'
     or (v_order.metadata->>'refunded_cents')::bigint <> 10000
     or (v_order.metadata->>'seller_refunded_cents')::bigint <> 9000
     or (v_order.metadata->>'platform_fee_refunded_cents')::bigint <> 1000
     or v_escrow.amount_cents <> 0 or v_escrow.status <> 'refunded' then
    raise exception 'Full refund did not close canonical money state';
  end if;
end
$$;

-- Separate order: once payout ledger has reserved the Seller escrow, approving
-- a refund does not fake a clawback. Provider attachment must fail closed.
set local role service_role;
select * from public.request_seller_payout(
  'd5000000-0000-0000-0000-000000000005',
  'ac000000-0000-0000-0000-000000000001',
  now() - interval '7 days'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select public.buyer_request_order_refund(
  'e2000000-0000-0000-0000-000000000002',
  1000,
  'Refund requested after Seller payout claim.',
  'ab000000-0000-0000-0000-000000000004'
) as payout_blocked_refund_id \gset
select set_config('m3refund.payout_blocked_refund_id', :'payout_blocked_refund_id', false);

reset role;
set local role service_role;
select public.admin_review_refund_request(
  'd4000000-0000-0000-0000-000000000004',
  :'payout_blocked_refund_id'::uuid,
  'approved',
  'Approved operational intent; provider execution must still fail closed.'
);

do $$
begin
  begin
    perform public.attach_refund_provider_reference(
      current_setting('m3refund.payout_blocked_refund_id')::uuid,
      'simulator',
      'rf_m3_should_not_attach'
    );
    raise exception 'Refund execution unexpectedly bypassed active Seller payout claim';
  exception when sqlstate '55000' then null;
  end;
end
$$;

reset role;
rollback;

select 'M3 refund and dispute operations regression suite passed' as result;
