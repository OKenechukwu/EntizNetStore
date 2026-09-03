\set ON_ERROR_STOP on

-- Digital-only orders must never require fabricated shipping evidence. This test
-- also proves the immutable event ledger cannot be forged through service_role.
begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000','c1000000-0000-0000-0000-000000000001','authenticated','authenticated','digital-fulfillment-buyer@test.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','c2000000-0000-0000-0000-000000000002','authenticated','authenticated','digital-fulfillment-seller@test.invalid','',now(),'{}','{}',now(),now());

insert into public.profiles_buyer(id, display_name)
values ('c1000000-0000-0000-0000-000000000001','Digital Fulfillment Buyer');

insert into public.profiles_seller(id, storefront_name, store_slug, verification_status)
values ('c2000000-0000-0000-0000-000000000002','Digital Fulfillment Seller','digital-fulfillment-seller','verified');

insert into public.orders(
  id, order_number, buyer_id, seller_id, status, subtotal_cents, total_cents,
  payment_status, fulfillment_status, metadata
)
values (
  'd1000000-0000-0000-0000-000000000001',
  'ENS-FULFILL-DIGITAL',
  'c1000000-0000-0000-0000-000000000001',
  'c2000000-0000-0000-0000-000000000002',
  'confirmed', 1900, 1900, 'paid', 'unfulfilled', '{}'::jsonb
);

insert into public.order_items(
  order_id, quantity, price_cents, total_cents, product_title,
  requires_shipping, is_digital, fulfillment_status
)
values (
  'd1000000-0000-0000-0000-000000000001',
  1, 1900, 1900, 'Digital Fulfillment Item', false, true, 'unfulfilled'
);

insert into public.escrow_transactions(order_id, seller_id, amount_cents, status)
values (
  'd1000000-0000-0000-0000-000000000001',
  'c2000000-0000-0000-0000-000000000002',
  1710,
  'held'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','c2000000-0000-0000-0000-000000000002',true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c2000000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select * from public.transition_seller_order(
  'd1000000-0000-0000-0000-000000000001',
  'processing', null, null
);

-- A client may be stale or malicious and still ask to ship a digital order.
-- Database authority must reject it even if tracking strings are supplied.
do $$
begin
  begin
    perform * from public.transition_seller_order(
      'd1000000-0000-0000-0000-000000000001',
      'shipped', 'FAKE-DIGITAL-TRACKING', 'Fake Carrier'
    );
    raise exception 'digital-only shipping unexpectedly succeeded';
  exception when sqlstate '22023' then
    if sqlerrm <> 'shipping_not_required_for_order' then
      raise;
    end if;
  end;
end
$$;

-- Digital-only orders complete directly from processing to delivered/fulfilled.
select * from public.transition_seller_order(
  'd1000000-0000-0000-0000-000000000001',
  'delivered', null, null
);
select * from public.transition_seller_order(
  'd1000000-0000-0000-0000-000000000001',
  'delivered', null, null
);

-- Fulfillment transitions above deliberately execute as the Seller so their RLS
-- boundary is covered. Cross-user transaction-completeness assertions below run
-- as the trusted test observer; otherwise notification RLS correctly hides the
-- Buyer's notification and turns a successful transaction into a false negative.
reset role;

do $$
declare
  v_status text;
  v_fulfillment text;
  v_tracking text;
  v_carrier text;
  v_shipped timestamptz;
  v_delivered timestamptz;
  v_item text;
  v_events integer;
  v_shipped_events integer;
  v_notifications integer;
  v_escrow text;
begin
  select status, fulfillment_status, tracking_number, shipping_carrier, shipped_at, delivered_at
    into v_status, v_fulfillment, v_tracking, v_carrier, v_shipped, v_delivered
  from public.orders
  where id='d1000000-0000-0000-0000-000000000001';

  select fulfillment_status into v_item
  from public.order_items
  where order_id='d1000000-0000-0000-0000-000000000001';

  select count(*), count(*) filter (where to_status='shipped')
    into v_events, v_shipped_events
  from public.order_fulfillment_events
  where order_id='d1000000-0000-0000-0000-000000000001';

  select count(*) into v_notifications
  from public.notifications
  where metadata->>'order_id'='d1000000-0000-0000-0000-000000000001';

  select status into v_escrow
  from public.escrow_transactions
  where order_id='d1000000-0000-0000-0000-000000000001';

  if v_status <> 'delivered'
     or v_fulfillment <> 'fulfilled'
     or v_tracking is not null
     or v_carrier is not null
     or v_shipped is not null
     or v_delivered is null
     or v_item <> 'fulfilled'
     or v_events <> 2
     or v_shipped_events <> 0
     or v_notifications <> 2
     or v_escrow <> 'held' then
    raise exception 'digital fulfillment invariant failed: status %, fulfillment %, tracking %, carrier %, shipped %, delivered %, item %, events %, shipped_events %, notifications %, escrow %',
      v_status, v_fulfillment, v_tracking, v_carrier, v_shipped, v_delivered,
      v_item, v_events, v_shipped_events, v_notifications, v_escrow;
  end if;
end
$$;

-- Service role may inspect the ledger but cannot manufacture evidence directly.
set local role service_role;
do $$
begin
  begin
    insert into public.order_fulfillment_events(
      order_id, from_status, to_status, fulfillment_status, actor_id
    ) values (
      'd1000000-0000-0000-0000-000000000001',
      'processing', 'shipped', 'partial',
      'c2000000-0000-0000-0000-000000000002'
    );
    raise exception 'service_role forged fulfillment evidence';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

rollback;
select 'Digital fulfillment + immutable ledger regression passed' as result;
