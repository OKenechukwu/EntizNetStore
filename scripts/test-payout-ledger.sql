\set ON_ERROR_STOP on

-- EntizNetStore provider-neutral payout ledger regression suite.
-- Runs only against the disposable local Supabase database created by CI.
-- All fixture data is rolled back.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'payout-buyer@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a3000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'payout-seller1@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a4000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'payout-seller2@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles_buyer(id, display_name)
values ('a1000000-0000-0000-0000-000000000001', 'Payout Buyer');

insert into public.profiles_seller(id, storefront_name, verification_status)
values
  ('a3000000-0000-0000-0000-000000000003', 'Payout Seller One', 'verified'),
  ('a4000000-0000-0000-0000-000000000004', 'Payout Seller Two', 'verified');

insert into public.orders(
  id, order_number, buyer_id, seller_id, status,
  subtotal_cents, total_cents, payment_status, fulfillment_status,
  delivered_at, created_at, updated_at
)
values
  ('b1000000-0000-0000-0000-000000000001', 'ENS-PAYOUT-001', 'a1000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000003', 'delivered', 1000, 1000, 'paid', 'fulfilled', now() - interval '10 days', now() - interval '11 days', now()),
  ('b2000000-0000-0000-0000-000000000002', 'ENS-PAYOUT-002', 'a1000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000003', 'delivered', 2000, 2000, 'paid', 'fulfilled', now() - interval '9 days', now() - interval '10 days', now()),
  ('b3000000-0000-0000-0000-000000000003', 'ENS-PAYOUT-003', 'a1000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000003', 'delivered', 600, 600, 'paid', 'fulfilled', now() - interval '1 day', now() - interval '2 days', now()),
  ('b4000000-0000-0000-0000-000000000004', 'ENS-PAYOUT-004', 'a1000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000004', 'delivered', 800, 800, 'paid', 'fulfilled', now() - interval '10 days', now() - interval '11 days', now());

insert into public.escrow_transactions(
  id, order_id, seller_id, amount_cents, status, created_at, updated_at
)
values
  ('c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000003', 900, 'held', now() - interval '10 days', now()),
  ('c2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000003', 1800, 'held', now() - interval '9 days', now()),
  ('c3000000-0000-0000-0000-000000000003', 'b3000000-0000-0000-0000-000000000003', 'a3000000-0000-0000-0000-000000000003', 500, 'held', now() - interval '1 day', now()),
  ('c4000000-0000-0000-0000-000000000004', 'b4000000-0000-0000-0000-000000000004', 'a4000000-0000-0000-0000-000000000004', 700, 'held', now() - interval '10 days', now());

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- Seller 1 claims only escrow delivered before the configured cutoff.
select *
from public.request_seller_payout(
  'a3000000-0000-0000-0000-000000000003',
  'd1000000-0000-0000-0000-000000000001',
  now() - interval '7 days'
);

do $$
declare
  v_request_id uuid;
  v_amount bigint;
  v_items integer;
  v_recent_claims integer;
begin
  select id, amount_cents into v_request_id, v_amount
  from public.payout_requests
  where seller_id = 'a3000000-0000-0000-0000-000000000003'
    and idempotency_key = 'd1000000-0000-0000-0000-000000000001';

  select count(*) into v_items
  from public.payout_items
  where payout_request_id = v_request_id and status = 'reserved';

  select count(*) into v_recent_claims
  from public.payout_items
  where escrow_transaction_id = 'c3000000-0000-0000-0000-000000000003'
    and status in ('reserved', 'settled');

  if v_amount <> 2700 or v_items <> 2 or v_recent_claims <> 0 then
    raise exception 'Payout eligibility/claim failed: amount %, items %, recent claims %',
      v_amount, v_items, v_recent_claims;
  end if;
end
$$;

-- Exact retry returns the durable request even when the moving cutoff changes.
select *
from public.request_seller_payout(
  'a3000000-0000-0000-0000-000000000003',
  'd1000000-0000-0000-0000-000000000001',
  now()
);

do $$
declare
  v_requests integer;
  v_items integer;
begin
  select count(*) into v_requests
  from public.payout_requests
  where seller_id = 'a3000000-0000-0000-0000-000000000003'
    and idempotency_key = 'd1000000-0000-0000-0000-000000000001';

  select count(*) into v_items
  from public.payout_items pi
  join public.payout_requests pr on pr.id = pi.payout_request_id
  where pr.seller_id = 'a3000000-0000-0000-0000-000000000003'
    and pr.idempotency_key = 'd1000000-0000-0000-0000-000000000001';

  if v_requests <> 1 or v_items <> 2 then
    raise exception 'Idempotent payout retry duplicated records: requests %, items %', v_requests, v_items;
  end if;
end
$$;

-- A different request cannot claim the two escrow rows already reserved above.
do $$
begin
  begin
    perform *
    from public.request_seller_payout(
      'a3000000-0000-0000-0000-000000000003',
      'd2000000-0000-0000-0000-000000000002',
      now() - interval '7 days'
    );
    raise exception 'Second payout unexpectedly double-claimed reserved escrow';
  exception when sqlstate 'P0001' then
    null;
  end;
end
$$;

-- The same idempotency UUID is scoped per seller, not globally.
select *
from public.request_seller_payout(
  'a4000000-0000-0000-0000-000000000004',
  'd1000000-0000-0000-0000-000000000001',
  now() - interval '7 days'
);

-- Sellers can read only their own payout ledger and can never execute mutation RPCs.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a3000000-0000-0000-0000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a3000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

do $$
declare
  v_own integer;
  v_other integer;
  v_items integer;
begin
  select count(*) into v_own
  from public.payout_requests
  where seller_id = 'a3000000-0000-0000-0000-000000000003';

  select count(*) into v_other
  from public.payout_requests
  where seller_id = 'a4000000-0000-0000-0000-000000000004';

  select count(*) into v_items from public.payout_items;

  if v_own <> 1 or v_other <> 0 or v_items <> 2 then
    raise exception 'Seller payout RLS failed: own %, other %, visible items %', v_own, v_other, v_items;
  end if;
end
$$;

do $$
begin
  begin
    perform *
    from public.request_seller_payout(
      'a3000000-0000-0000-0000-000000000003',
      'd3000000-0000-0000-0000-000000000003',
      now()
    );
    raise exception 'Authenticated seller unexpectedly executed payout mutation RPC';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

do $$
begin
  begin
    perform 1 from public.payout_provider_events limit 1;
    raise exception 'Authenticated seller unexpectedly read raw payout provider events';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

reset role;
set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- Attach provider reference and exercise retryable -> success state transitions.
select public.attach_seller_payout_provider_reference(
  (select id from public.payout_requests
   where seller_id = 'a3000000-0000-0000-0000-000000000003'
     and idempotency_key = 'd1000000-0000-0000-0000-000000000001'),
  'simulator',
  'po_payout_success'
);

do $$
begin
  begin
    perform public.finalize_seller_payout_v1(
      'wrong-provider',
      'evt_wrong_provider',
      'payout.failed',
      (select id from public.payout_requests
       where seller_id = 'a3000000-0000-0000-0000-000000000003'
         and idempotency_key = 'd1000000-0000-0000-0000-000000000001'),
      'po_payout_success',
      'retryable_failure'
    );
    raise exception 'Cross-provider payout finalization unexpectedly succeeded';
  exception when sqlstate '22023' then
    null;
  end;
end
$$;

select public.finalize_seller_payout_v1(
  'simulator',
  'evt_payout_retryable',
  'payout.retryable_failure',
  (select id from public.payout_requests
   where seller_id = 'a3000000-0000-0000-0000-000000000003'
     and idempotency_key = 'd1000000-0000-0000-0000-000000000001'),
  'po_payout_success',
  'retryable_failure'
);

do $$
declare
  v_status text;
  v_reserved integer;
  v_released_escrow integer;
begin
  select status into v_status
  from public.payout_requests
  where seller_id = 'a3000000-0000-0000-0000-000000000003'
    and idempotency_key = 'd1000000-0000-0000-0000-000000000001';

  select count(*) into v_reserved
  from public.payout_items pi
  join public.payout_requests pr on pr.id = pi.payout_request_id
  where pr.idempotency_key = 'd1000000-0000-0000-0000-000000000001'
    and pr.seller_id = 'a3000000-0000-0000-0000-000000000003'
    and pi.status = 'reserved';

  select count(*) into v_released_escrow
  from public.escrow_transactions
  where id in (
    'c1000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000002'
  ) and status = 'released';

  if v_status <> 'processing' or v_reserved <> 2 or v_released_escrow <> 0 then
    raise exception 'Retryable payout failure changed money state: status %, reserved %, released escrow %',
      v_status, v_reserved, v_released_escrow;
  end if;
end
$$;

select public.finalize_seller_payout_v1(
  'simulator',
  'evt_payout_success',
  'payout.succeeded',
  (select id from public.payout_requests
   where seller_id = 'a3000000-0000-0000-0000-000000000003'
     and idempotency_key = 'd1000000-0000-0000-0000-000000000001'),
  'po_payout_success',
  'succeeded'
);

do $$
declare
  v_status text;
  v_settled integer;
  v_released_escrow integer;
  v_release_reason integer;
begin
  select status into v_status
  from public.payout_requests
  where seller_id = 'a3000000-0000-0000-0000-000000000003'
    and idempotency_key = 'd1000000-0000-0000-0000-000000000001';

  select count(*) into v_settled
  from public.payout_items pi
  join public.payout_requests pr on pr.id = pi.payout_request_id
  where pr.idempotency_key = 'd1000000-0000-0000-0000-000000000001'
    and pr.seller_id = 'a3000000-0000-0000-0000-000000000003'
    and pi.status = 'settled';

  select count(*) into v_released_escrow
  from public.escrow_transactions
  where id in (
    'c1000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000002'
  ) and status = 'released';

  select count(*) into v_release_reason
  from public.escrow_transactions
  where id in (
    'c1000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000002'
  ) and release_reason like 'seller_payout:%';

  if v_status <> 'succeeded' or v_settled <> 2 or v_released_escrow <> 2 or v_release_reason <> 2 then
    raise exception 'Payout success did not settle exactly once: status %, items %, escrow %, reasons %',
      v_status, v_settled, v_released_escrow, v_release_reason;
  end if;
end
$$;

-- Exact event replay is a no-op and reports processed=false.
do $$
declare
  v_processed boolean;
begin
  select public.finalize_seller_payout_v1(
    'simulator',
    'evt_payout_success',
    'payout.succeeded',
    (select id from public.payout_requests
     where seller_id = 'a3000000-0000-0000-0000-000000000003'
       and idempotency_key = 'd1000000-0000-0000-0000-000000000001'),
    'po_payout_success',
    'succeeded'
  ) into v_processed;

  if v_processed is distinct from false then
    raise exception 'Exact payout event replay was not deduplicated';
  end if;
end
$$;

-- A later failure cannot downgrade already-paid money.
select public.finalize_seller_payout_v1(
  'simulator',
  'evt_payout_late_failure',
  'payout.failed',
  (select id from public.payout_requests
   where seller_id = 'a3000000-0000-0000-0000-000000000003'
     and idempotency_key = 'd1000000-0000-0000-0000-000000000001'),
  'po_payout_success',
  'terminal_failure'
);

do $$
declare
  v_status text;
  v_held integer;
begin
  select status into v_status
  from public.payout_requests
  where seller_id = 'a3000000-0000-0000-0000-000000000003'
    and idempotency_key = 'd1000000-0000-0000-0000-000000000001';

  select count(*) into v_held
  from public.escrow_transactions
  where id in (
    'c1000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000002'
  ) and status = 'held';

  if v_status <> 'succeeded' or v_held <> 0 then
    raise exception 'Late payout failure downgraded succeeded money state';
  end if;
end
$$;

-- The recent escrow becomes eligible under a later cutoff. Terminal provider
-- failure must release only the payout claim, never the escrow money itself.
select *
from public.request_seller_payout(
  'a3000000-0000-0000-0000-000000000003',
  'd4000000-0000-0000-0000-000000000004',
  now()
);

select public.attach_seller_payout_provider_reference(
  (select id from public.payout_requests
   where seller_id = 'a3000000-0000-0000-0000-000000000003'
     and idempotency_key = 'd4000000-0000-0000-0000-000000000004'),
  'simulator',
  'po_payout_failure'
);

select public.finalize_seller_payout_v1(
  'simulator',
  'evt_payout_terminal_failure',
  'payout.failed',
  (select id from public.payout_requests
   where seller_id = 'a3000000-0000-0000-0000-000000000003'
     and idempotency_key = 'd4000000-0000-0000-0000-000000000004'),
  'po_payout_failure',
  'terminal_failure'
);

do $$
declare
  v_status text;
  v_item_status text;
  v_escrow_status text;
begin
  select status into v_status
  from public.payout_requests
  where seller_id = 'a3000000-0000-0000-0000-000000000003'
    and idempotency_key = 'd4000000-0000-0000-0000-000000000004';

  select pi.status into v_item_status
  from public.payout_items pi
  join public.payout_requests pr on pr.id = pi.payout_request_id
  where pr.seller_id = 'a3000000-0000-0000-0000-000000000003'
    and pr.idempotency_key = 'd4000000-0000-0000-0000-000000000004';

  select status into v_escrow_status
  from public.escrow_transactions
  where id = 'c3000000-0000-0000-0000-000000000003';

  if v_status <> 'failed' or v_item_status <> 'released' or v_escrow_status <> 'held' then
    raise exception 'Terminal payout failure did not release claim safely: request %, item %, escrow %',
      v_status, v_item_status, v_escrow_status;
  end if;
end
$$;

-- Released failed claim can be reserved by a new idempotency key.
select *
from public.request_seller_payout(
  'a3000000-0000-0000-0000-000000000003',
  'd5000000-0000-0000-0000-000000000005',
  now()
);

do $$
declare
  v_amount bigint;
  v_active_claims integer;
begin
  select amount_cents into v_amount
  from public.payout_requests
  where seller_id = 'a3000000-0000-0000-0000-000000000003'
    and idempotency_key = 'd5000000-0000-0000-0000-000000000005';

  select count(*) into v_active_claims
  from public.payout_items
  where escrow_transaction_id = 'c3000000-0000-0000-0000-000000000003'
    and status in ('reserved', 'settled');

  if v_amount <> 500 or v_active_claims <> 1 then
    raise exception 'Failed payout escrow was not safely reclaimable: amount %, active claims %',
      v_amount, v_active_claims;
  end if;
end
$$;

-- Operator cancellation also releases the ledger claim without changing escrow.
select public.cancel_seller_payout_request(
  (select id from public.payout_requests
   where seller_id = 'a3000000-0000-0000-0000-000000000003'
     and idempotency_key = 'd5000000-0000-0000-0000-000000000005'),
  'test operator cancellation'
);

do $$
declare
  v_request_status text;
  v_item_status text;
  v_escrow_status text;
begin
  select status into v_request_status
  from public.payout_requests
  where seller_id = 'a3000000-0000-0000-0000-000000000003'
    and idempotency_key = 'd5000000-0000-0000-0000-000000000005';

  select pi.status into v_item_status
  from public.payout_items pi
  join public.payout_requests pr on pr.id = pi.payout_request_id
  where pr.idempotency_key = 'd5000000-0000-0000-0000-000000000005'
    and pr.seller_id = 'a3000000-0000-0000-0000-000000000003';

  select status into v_escrow_status
  from public.escrow_transactions
  where id = 'c3000000-0000-0000-0000-000000000003';

  if v_request_status <> 'cancelled' or v_item_status <> 'released' or v_escrow_status <> 'held' then
    raise exception 'Operator payout cancellation violated escrow state';
  end if;
end
$$;

select 'EntizNetStore payout ledger regression verified' as result;

rollback;
