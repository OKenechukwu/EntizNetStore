#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('00000000-0000-0000-0000-000000000000','c1000000-0000-0000-0000-000000000001','authenticated','authenticated','concurrency-buyer@test.invalid','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','c2000000-0000-0000-0000-000000000002','authenticated','authenticated','concurrency-seller@test.invalid','',now(),'{}','{}',now(),now());
insert into public.profiles_buyer(id,display_name) values ('c1000000-0000-0000-0000-000000000001','Concurrency Buyer');
insert into public.profiles_seller(id,storefront_name,store_slug,verification_status)
values ('c2000000-0000-0000-0000-000000000002','Concurrency Seller','concurrency-seller','verified');
insert into public.orders(id,order_number,buyer_id,seller_id,status,subtotal_cents,total_cents,payment_status,fulfillment_status)
values ('c3000000-0000-0000-0000-000000000003','ENS-FULFILL-CONCURRENT','c1000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-000000000002','confirmed',1000,1000,'paid','unfulfilled');
insert into public.order_items(order_id,quantity,price_cents,total_cents,product_title,requires_shipping)
values ('c3000000-0000-0000-0000-000000000003',1,1000,1000,'Concurrent Item',true);
insert into public.escrow_transactions(order_id,seller_id,amount_cents,status)
values ('c3000000-0000-0000-0000-000000000003','c2000000-0000-0000-0000-000000000002',900,'held');
SQL

call_transition() {
  local status="$1"
  local tracking="${2:-}"
  local carrier="${3:-}"
  psql "$DB_URL" -v ON_ERROR_STOP=1 >/dev/null <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','c2000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"c2000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select * from public.transition_seller_order(
  'c3000000-0000-0000-0000-000000000003',
  '$status',
  nullif('$tracking',''),
  nullif('$carrier','')
);
commit;
SQL
}

call_transition processing & p1=$!
call_transition processing & p2=$!
wait "$p1"; wait "$p2"

call_transition shipped TRACK-CONCURRENT "Concurrent Carrier" & p3=$!
call_transition shipped TRACK-CONCURRENT "Concurrent Carrier" & p4=$!
wait "$p3"; wait "$p4"

psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare v_processing integer; v_shipped integer; v_notifications integer; v_item text; v_escrow text;
begin
  select count(*) filter (where to_status='processing'), count(*) filter (where to_status='shipped')
    into v_processing,v_shipped
  from public.order_fulfillment_events where order_id='c3000000-0000-0000-0000-000000000003';
  select count(*) into v_notifications from public.notifications where metadata->>'order_id'='c3000000-0000-0000-0000-000000000003';
  select fulfillment_status into v_item from public.order_items where order_id='c3000000-0000-0000-0000-000000000003';
  select status into v_escrow from public.escrow_transactions where order_id='c3000000-0000-0000-0000-000000000003';
  if v_processing <> 1 or v_shipped <> 1 or v_notifications <> 2 or v_item <> 'fulfilled' or v_escrow <> 'held' then
    raise exception 'concurrent transition invariant failed: processing %, shipped %, notifications %, item %, escrow %',v_processing,v_shipped,v_notifications,v_item,v_escrow;
  end if;
end $$;
SQL

echo "Atomic fulfillment concurrency regression passed"
