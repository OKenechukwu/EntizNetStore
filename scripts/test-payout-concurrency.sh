#!/usr/bin/env bash
set -uo pipefail

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
TMP_DIR="$(mktemp -d)"

cleanup() {
  psql "$DB_URL" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL' || true
delete from public.payout_provider_events
where payout_request_id in (
  select id from public.payout_requests
  where seller_id = 'e3000000-0000-0000-0000-000000000003'
);
delete from public.payout_items
where payout_request_id in (
  select id from public.payout_requests
  where seller_id = 'e3000000-0000-0000-0000-000000000003'
);
delete from public.payout_requests
where seller_id = 'e3000000-0000-0000-0000-000000000003';
delete from public.notifications
where metadata->>'order_id' = 'f1000000-0000-0000-0000-000000000001';
delete from public.escrow_transactions
where id = 'f2000000-0000-0000-0000-000000000002';
-- Settlement evidence is immutable in application operation. The disposable
-- concurrency fixture is torn down only by the local postgres test owner.
alter table private.order_settlement_confirmations disable trigger order_settlement_confirmation_immutable;
delete from private.order_settlement_confirmations
where order_id = 'f1000000-0000-0000-0000-000000000001';
alter table private.order_settlement_confirmations enable trigger order_settlement_confirmation_immutable;
delete from public.orders
where id = 'f1000000-0000-0000-0000-000000000001';
delete from public.profiles_seller
where id = 'e3000000-0000-0000-0000-000000000003';
delete from public.profiles_buyer
where id = 'e1000000-0000-0000-0000-000000000001';
delete from auth.users
where id in (
  'e1000000-0000-0000-0000-000000000001',
  'e3000000-0000-0000-0000-000000000003'
);
SQL
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'e1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'payout-race-buyer@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e3000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'payout-race-seller@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles_buyer(id, display_name)
values ('e1000000-0000-0000-0000-000000000001', 'Payout Race Buyer');

insert into public.profiles_seller(id, storefront_name, verification_status)
values ('e3000000-0000-0000-0000-000000000003', 'Payout Race Seller', 'verified');

insert into public.orders(
  id, order_number, buyer_id, seller_id, status,
  subtotal_cents, total_cents, payment_status, fulfillment_status,
  delivered_at, created_at, updated_at
)
values (
  'f1000000-0000-0000-0000-000000000001',
  'ENS-PAYOUT-RACE-001',
  'e1000000-0000-0000-0000-000000000001',
  'e3000000-0000-0000-0000-000000000003',
  'delivered',
  1100,
  1100,
  'paid',
  'fulfilled',
  now() - interval '10 days',
  now() - interval '11 days',
  now()
);

insert into public.escrow_transactions(
  id, order_id, seller_id, amount_cents, status, created_at, updated_at
)
values (
  'f2000000-0000-0000-0000-000000000002',
  'f1000000-0000-0000-0000-000000000001',
  'e3000000-0000-0000-0000-000000000003',
  1000,
  'held',
  now() - interval '10 days',
  now()
);

set role authenticated;
select set_config('request.jwt.claim.sub','e1000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}',false);
select public.confirm_buyer_order_receipt(
  'f1000000-0000-0000-0000-000000000001',
  'f3000000-0000-0000-0000-000000000003'
);
reset role;
SQL

run_request() {
  local key="$1"
  local out="$2"
  local err="$3"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -At >"$out" 2>"$err" <<SQL
set role service_role;
select payout_request_id
from public.request_seller_payout(
  'e3000000-0000-0000-0000-000000000003',
  '$key',
  now()
);
SQL
}

set +e
run_request 'e5000000-0000-0000-0000-000000000005' "$TMP_DIR/a.out" "$TMP_DIR/a.err" &
PID_A=$!
run_request 'e6000000-0000-0000-0000-000000000006' "$TMP_DIR/b.out" "$TMP_DIR/b.err" &
PID_B=$!

wait "$PID_A"
STATUS_A=$?
wait "$PID_B"
STATUS_B=$?
set -e

SUCCESS_COUNT=0
[[ "$STATUS_A" -eq 0 ]] && SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
[[ "$STATUS_B" -eq 0 ]] && SUCCESS_COUNT=$((SUCCESS_COUNT + 1))

if [[ "$SUCCESS_COUNT" -ne 1 ]]; then
  echo "Expected exactly one concurrent payout request to succeed; got $SUCCESS_COUNT" >&2
  echo "request A status=$STATUS_A" >&2
  cat "$TMP_DIR/a.err" >&2 || true
  echo "request B status=$STATUS_B" >&2
  cat "$TMP_DIR/b.err" >&2 || true
  exit 1
fi

psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare
  v_requests integer;
  v_active_items integer;
  v_active_amount bigint;
  v_escrow_status text;
begin
  select count(*) into v_requests
  from public.payout_requests
  where seller_id = 'e3000000-0000-0000-0000-000000000003';

  select count(*), coalesce(sum(amount_cents), 0)
    into v_active_items, v_active_amount
  from public.payout_items
  where escrow_transaction_id = 'f2000000-0000-0000-0000-000000000002'
    and status in ('reserved', 'settled');

  select status into v_escrow_status
  from public.escrow_transactions
  where id = 'f2000000-0000-0000-0000-000000000002';

  if v_requests <> 1 or v_active_items <> 1 or v_active_amount <> 1000 or v_escrow_status <> 'held' then
    raise exception 'Concurrent payout invariant failed: requests %, active items %, amount %, escrow %',
      v_requests, v_active_items, v_active_amount, v_escrow_status;
  end if;
end
$$;

select 'EntizNetStore concurrent trusted payout claim verified' as result;
SQL
