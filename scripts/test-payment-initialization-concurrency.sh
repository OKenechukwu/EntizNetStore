#!/usr/bin/env bash
set -euo pipefail

DB="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
BUYER_ID="a1000000-0000-0000-0000-000000000001"
SELLER_ID="a2000000-0000-0000-0000-000000000002"
PRODUCT_ID="a3000000-0000-0000-0000-000000000003"
VARIANT_ID="a4000000-0000-0000-0000-000000000004"
IDEMPOTENCY_KEY="a5000000-0000-0000-0000-000000000005"
TMP_DIR="$(mktemp -d)"

cleanup() {
  set +e
  psql "$DB" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<SQL
begin;
delete from public.payment_webhook_events where provider = 'concurrency-simulator';
delete from public.escrow_transactions where order_id in (
  select id from public.orders where buyer_id = '$BUYER_ID'::uuid
);
delete from public.inventory_reservations where payment_session_id in (
  select id from public.payment_sessions where buyer_id = '$BUYER_ID'::uuid
);
delete from public.order_items where order_id in (
  select id from public.orders where buyer_id = '$BUYER_ID'::uuid
);
delete from public.orders where buyer_id = '$BUYER_ID'::uuid;
delete from public.payment_sessions where buyer_id = '$BUYER_ID'::uuid;
delete from public.product_media where product_id = '$PRODUCT_ID'::uuid;
delete from public.product_categories where product_id = '$PRODUCT_ID'::uuid;
delete from public.product_variants where id = '$VARIANT_ID'::uuid;
delete from public.products where id = '$PRODUCT_ID'::uuid;
delete from public.profiles_seller where id = '$SELLER_ID'::uuid;
delete from public.profiles_buyer where id = '$BUYER_ID'::uuid;
delete from auth.users where id in ('$BUYER_ID'::uuid, '$SELLER_ID'::uuid);
revoke execute on function public.create_checkout_session(jsonb,jsonb,uuid) from authenticated;
commit;
SQL
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

# The historical checkout helper is enabled only in this disposable local DB to
# build a realistic payment session/order/reservation fixture. The authority is
# revoked immediately after setup and is never part of production behavior.
psql "$DB" -v ON_ERROR_STOP=1 -f scripts/prepare-legacy-commerce-security-test.sql >/dev/null

psql "$DB" -v ON_ERROR_STOP=1 >/dev/null <<SQL
begin;
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '$BUYER_ID', 'authenticated', 'authenticated', 'payment-race-buyer@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '$SELLER_ID', 'authenticated', 'authenticated', 'payment-race-seller@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles_buyer(id, display_name)
values ('$BUYER_ID', 'Payment Race Buyer');

insert into public.profiles_seller(
  id, storefront_name, verification_status, return_policy, shipping_policy
)
values (
  '$SELLER_ID', 'Payment Race Seller', 'verified',
  'Returns accepted within 14 days for eligible unused items.',
  'Tracked shipping is dispatched within three business days.'
);

insert into public.products(
  id, seller_id, title, slug, status, moderation_status, base_price,
  requires_shipping, marketplace_brand
)
values (
  '$PRODUCT_ID', '$SELLER_ID', 'Payment Race Product', 'payment-race-product',
  'draft', 'not_submitted', 15.00, true, 'entiznetstore'
);

insert into public.product_variants(
  id, product_id, title, sku, price, track_inventory, inventory_quantity,
  inventory_policy, is_active, position
)
values (
  '$VARIANT_ID', '$PRODUCT_ID', 'Default', 'PAYMENT-RACE-SKU', 15.00,
  true, 20, 'deny', true, 0
);

insert into public.product_categories(product_id, category_id)
select '$PRODUCT_ID'::uuid, c.id
from public.categories c
where c.is_active
order by c.name
limit 1;

insert into public.product_media(product_id, type, url, position)
values ('$PRODUCT_ID', 'image', 'https://example.invalid/payment-race.webp', 0);

update public.products
set moderation_status = 'approved', status = 'active'
where id = '$PRODUCT_ID'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', '$BUYER_ID', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"$BUYER_ID","role":"authenticated"}',
  true
);

select * from public.create_checkout_session(
  jsonb_build_array(jsonb_build_object(
    'productId', '$PRODUCT_ID',
    'variantId', '$VARIANT_ID',
    'quantity', 1
  )),
  jsonb_build_object(
    'name', 'Payment Race Buyer',
    'line1', '1 Concurrency Street',
    'city', 'Test City',
    'postal_code', '10000',
    'country', 'US'
  ),
  '$IDEMPOTENCY_KEY'
);
reset role;
revoke execute on function public.create_checkout_session(jsonb,jsonb,uuid) from authenticated;
commit;
SQL

SESSION_ID="$(psql "$DB" -Atq -v ON_ERROR_STOP=1 -c "select id from public.payment_sessions where buyer_id = '$BUYER_ID'::uuid and idempotency_key = '$IDEMPOTENCY_KEY'::uuid")"
if [[ -z "$SESSION_ID" ]]; then
  echo "Payment concurrency fixture did not create a session" >&2
  exit 1
fi

pids=()
for i in 1 2 3 4 5 6 7 8; do
  attempt="c1000000-0000-0000-0000-00000000000${i}"
  (
    psql "$DB" -v ON_ERROR_STOP=1 >/dev/null 2>"$TMP_DIR/attempt-${i}.err" <<SQL
set role service_role;
select public.service_claim_checkout_payment_initialization(
  '$SESSION_ID'::uuid,
  '$BUYER_ID'::uuid,
  '$attempt'::uuid
);
SQL
  ) &
  pids+=("$!")
done

successes=0
failures=0
for pid in "${pids[@]}"; do
  if wait "$pid"; then
    successes=$((successes + 1))
  else
    failures=$((failures + 1))
  fi
done

if [[ "$successes" -ne 1 || "$failures" -ne 7 ]]; then
  echo "Expected exactly one payment initialization claim winner; successes=$successes failures=$failures" >&2
  for file in "$TMP_DIR"/*.err; do
    [[ -s "$file" ]] && cat "$file" >&2
  done
  exit 1
fi

WINNING_ATTEMPT="$(psql "$DB" -Atq -v ON_ERROR_STOP=1 -c "select payment_initialization_attempt_id from public.payment_sessions where id = '$SESSION_ID'::uuid")"
if [[ -z "$WINNING_ATTEMPT" ]]; then
  echo "Winning payment initialization attempt was not persisted" >&2
  exit 1
fi

# Same-attempt retry is locally idempotent; a different attempt remains blocked.
psql "$DB" -v ON_ERROR_STOP=1 >/dev/null <<SQL
set role service_role;
select public.service_claim_checkout_payment_initialization(
  '$SESSION_ID'::uuid,
  '$BUYER_ID'::uuid,
  '$WINNING_ATTEMPT'::uuid
);
SQL

if psql "$DB" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<SQL
set role service_role;
select public.service_claim_checkout_payment_initialization(
  '$SESSION_ID'::uuid,
  '$BUYER_ID'::uuid,
  'cf000000-0000-0000-0000-00000000000f'::uuid
);
SQL
then
  echo "A conflicting payment initialization attempt unexpectedly succeeded" >&2
  exit 1
fi

# Browser cancellation must fail once trusted payment initialization has begun.
if psql "$DB" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<SQL
set role authenticated;
select set_config('request.jwt.claim.sub', '$BUYER_ID', false);
select set_config('request.jwt.claims', '{"sub":"$BUYER_ID","role":"authenticated"}', false);
select public.cancel_checkout_session('$SESSION_ID'::uuid);
SQL
then
  echo "Buyer cancellation unexpectedly succeeded after payment initialization claim" >&2
  exit 1
fi

# Simulate a transport-ambiguous provider call. The reconciliation marker must
# preserve checkout/order/reservation state and keep the durable retry lock.
psql "$DB" -v ON_ERROR_STOP=1 >/dev/null <<SQL
set role service_role;
select public.service_mark_checkout_payment_initialization_uncertain(
  '$SESSION_ID'::uuid,
  '$BUYER_ID'::uuid,
  '$WINNING_ATTEMPT'::uuid
);
reset role;

do \$\$
declare
  v_session_status text;
  v_order_status text;
  v_payment_status text;
  v_reservation_status text;
  v_attempt uuid;
  v_uncertain boolean;
begin
  select status, payment_initialization_attempt_id,
         coalesce((metadata->>'payment_initialization_uncertain')::boolean, false)
    into v_session_status, v_attempt, v_uncertain
  from public.payment_sessions
  where id = '$SESSION_ID'::uuid;

  select status, payment_status into v_order_status, v_payment_status
  from public.orders
  where payment_session_id = '$SESSION_ID'::uuid
  limit 1;

  select status into v_reservation_status
  from public.inventory_reservations
  where payment_session_id = '$SESSION_ID'::uuid
  limit 1;

  if v_session_status <> 'pending'
     or v_order_status <> 'pending'
     or v_payment_status <> 'pending'
     or v_reservation_status <> 'pending'
     or v_attempt <> '$WINNING_ATTEMPT'::uuid
     or not v_uncertain then
    raise exception 'Reconciliation lock invariant failed: session %, order %, payment %, reservation %, attempt %, uncertain %',
      v_session_status, v_order_status, v_payment_status, v_reservation_status, v_attempt, v_uncertain;
  end if;
end
\$\$;
SQL

echo "EntizNetStore concurrent payment initialization authority regression passed: one winner, seven conflicts"

# Tear down the deterministic concurrency fixture before the reconciliation
# health suite, which intentionally reuses fixed UUIDs for reproducibility.
cleanup
trap - EXIT

psql "$DB" -v ON_ERROR_STOP=1 -f scripts/test-payment-reconciliation-health.sql
