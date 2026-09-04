\set ON_ERROR_STOP on

-- Adversarial fulfillment authority regression. Disposable local DB only.
begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000','a1000000-0000-0000-0000-000000000001','authenticated','authenticated','fulfillment-buyer@test.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','a2000000-0000-0000-0000-000000000002','authenticated','authenticated','fulfillment-seller@test.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','a3000000-0000-0000-0000-000000000003','authenticated','authenticated','fulfillment-other@test.invalid','',now(),'{}','{}',now(),now());

insert into public.profiles_buyer(id, display_name)
values ('a1000000-0000-0000-0000-000000000001','Fulfillment Buyer');

insert into public.profiles_seller(id, storefront_name, store_slug, verification_status)
values
  ('a2000000-0000-0000-0000-000000000002','Fulfillment Seller','fulfillment-seller','verified'),
  ('a3000000-0000-0000-0000-000000000003','Other Seller','fulfillment-other','verified');

insert into public.orders(
  id, order_number, buyer_id, seller_id, status, subtotal_cents, total_cents,
  payment_status, fulfillment_status, shipping_address, metadata
)
values
  ('b1000000-0000-0000-0000-000000000001','ENS-FULFILL-PAID','a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002','confirmed',2500,2500,'paid','unfulfilled','{"country":"US"}','{}'),
  ('b2000000-0000-0000-0000-000000000002','ENS-FULFILL-UNPAID','a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002','confirmed',2500,2500,'pending','unfulfilled','{"country":"US"}','{}'),
  ('b3000000-0000-0000-0000-000000000003','ENS-FULFILL-ROLLBACK','a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002','confirmed',2500,2500,'paid','unfulfilled','{"country":"US"}','{}');

insert into public.order_items(order_id, quantity, price_cents, total_cents, product_title, requires_shipping)
values
  ('b1000000-0000-0000-0000-000000000001',1,2500,2500,'Fulfillment Physical Item',true),
  ('b2000000-0000-0000-0000-000000000002',1,2500,2500,'Unpaid Physical Item',true),
  ('b3000000-0000-0000-0000-000000000003',1,2500,2500,'Rollback Physical Item',true);

insert into public.escrow_transactions(order_id, seller_id, amount_cents, status)
values
  ('b1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002',2250,'held'),
  ('b3000000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000002',2250,'held');

-- Buyer cannot fulfill their own purchase.
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
do $$ begin
  begin
    perform * from public.transition_seller_order('b1000000-0000-0000-0000-000000000001','processing',null,null);
    raise exception 'buyer fulfillment unexpectedly succeeded';
  exception when sqlstate '42501' then null; end;
end $$;

-- Unrelated seller cannot mutate another seller's order.
select set_config('request.jwt.claim.sub','a3000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"a3000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
do $$ begin
  begin
    perform * from public.transition_seller_order('b1000000-0000-0000-0000-000000000001','processing',null,null);
    raise exception 'cross-seller fulfillment unexpectedly succeeded';
  exception when sqlstate '42501' then null; end;
end $$;

-- Seller cannot fulfill unpaid commerce.
select set_config('request.jwt.claim.sub','a2000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"a2000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
do $$ begin
  begin
    perform * from public.transition_seller_order('b2000000-0000-0000-0000-000000000002','processing',null,null);
    raise exception 'unpaid fulfillment unexpectedly succeeded';
  exception when sqlstate '22023' then
    if sqlerrm <> 'only_paid_orders_can_be_fulfilled' then raise; end if;
  end;
end $$;

-- Illegal status jump fails closed.
do $$ begin
  begin
    perform * from public.transition_seller_order('b1000000-0000-0000-0000-000000000001','shipped','T1','Carrier');
    raise exception 'confirmed -> shipped jump unexpectedly succeeded';
  exception when sqlstate '22023' then
    if sqlerrm <> 'invalid_fulfillment_transition' then raise; end if;
  end;
end $$;

-- First transition and exact retry are idempotent as the authenticated seller.
select * from public.transition_seller_order('b1000000-0000-0000-0000-000000000001','processing',null,null);
select * from public.transition_seller_order('b1000000-0000-0000-0000-000000000001','processing',null,null);

-- Cross-table atomicity is inspected outside seller RLS so the buyer's private
-- notification is observable without weakening the actual notification policy.
reset role;
do $$
declare v_events integer; v_notifications integer; v_item text; v_escrow text;
begin
  select count(*) into v_events from public.order_fulfillment_events where order_id='b1000000-0000-0000-0000-000000000001';
  select count(*) into v_notifications from public.notifications
    where user_id='a1000000-0000-0000-0000-000000000001'
      and metadata->>'order_id'='b1000000-0000-0000-0000-000000000001';
  select fulfillment_status into v_item from public.order_items where order_id='b1000000-0000-0000-0000-000000000001';
  select status into v_escrow from public.escrow_transactions where order_id='b1000000-0000-0000-0000-000000000001';
  if v_events <> 1 or v_notifications <> 1 or v_item <> 'unfulfilled' or v_escrow <> 'held' then
    raise exception 'processing atomic/idempotent invariant failed: events %, notifications %, item %, escrow %', v_events,v_notifications,v_item,v_escrow;
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','a2000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"a2000000-0000-0000-0000-000000000002","role":"authenticated"}',true);

-- Shipping validates bounded, single-line carrier/tracking data.
do $$ begin
  begin
    perform * from public.transition_seller_order('b1000000-0000-0000-0000-000000000001','shipped',null,null);
    raise exception 'shipping without tracking unexpectedly succeeded';
  exception when sqlstate '22023' then
    if sqlerrm <> 'carrier_and_tracking_required' then raise; end if;
  end;
  begin
    perform * from public.transition_seller_order('b1000000-0000-0000-0000-000000000001','shipped',E'BAD\nTRACK','Carrier');
    raise exception 'control-character tracking unexpectedly succeeded';
  exception when sqlstate '22023' then
    if sqlerrm <> 'invalid_tracking_number' then raise; end if;
  end;
end $$;

select * from public.transition_seller_order('b1000000-0000-0000-0000-000000000001','shipped','TRACK-001','Verified Carrier');
select * from public.transition_seller_order('b1000000-0000-0000-0000-000000000001','shipped','TRACK-001','Verified Carrier');

do $$ begin
  begin
    perform * from public.transition_seller_order('b1000000-0000-0000-0000-000000000001','shipped','TRACK-CONFLICT','Verified Carrier');
    raise exception 'conflicting tracking retry unexpectedly succeeded';
  exception when sqlstate '22023' then
    if sqlerrm <> 'conflicting_tracking_retry' then raise; end if;
  end;
end $$;

reset role;
do $$
declare v_status text; v_fulfillment text; v_item text; v_events integer; v_notifications integer; v_escrow text;
begin
  select status, fulfillment_status into v_status,v_fulfillment from public.orders where id='b1000000-0000-0000-0000-000000000001';
  select fulfillment_status into v_item from public.order_items where order_id='b1000000-0000-0000-0000-000000000001';
  select count(*) into v_events from public.order_fulfillment_events where order_id='b1000000-0000-0000-0000-000000000001';
  select count(*) into v_notifications from public.notifications
    where user_id='a1000000-0000-0000-0000-000000000001'
      and metadata->>'order_id'='b1000000-0000-0000-0000-000000000001';
  select status into v_escrow from public.escrow_transactions where order_id='b1000000-0000-0000-0000-000000000001';
  if v_status <> 'shipped' or v_fulfillment <> 'partial' or v_item <> 'fulfilled' or v_events <> 2 or v_notifications <> 2 or v_escrow <> 'held' then
    raise exception 'shipped invariant failed: status %, fulfillment %, item %, events %, notifications %, escrow %', v_status,v_fulfillment,v_item,v_events,v_notifications,v_escrow;
  end if;
end $$;

-- Delivery completes fulfillment but deliberately leaves escrow held.
set local role authenticated;
select set_config('request.jwt.claim.sub','a2000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"a2000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select * from public.transition_seller_order('b1000000-0000-0000-0000-000000000001','delivered',null,null);
select * from public.transition_seller_order('b1000000-0000-0000-0000-000000000001','delivered',null,null);

reset role;
do $$
declare v_status text; v_fulfillment text; v_events integer; v_notifications integer; v_escrow text; v_delivered timestamptz;
begin
  select status, fulfillment_status, delivered_at into v_status,v_fulfillment,v_delivered from public.orders where id='b1000000-0000-0000-0000-000000000001';
  select count(*) into v_events from public.order_fulfillment_events where order_id='b1000000-0000-0000-0000-000000000001';
  select count(*) into v_notifications from public.notifications
    where user_id='a1000000-0000-0000-0000-000000000001'
      and metadata->>'order_id'='b1000000-0000-0000-0000-000000000001';
  select status into v_escrow from public.escrow_transactions where order_id='b1000000-0000-0000-0000-000000000001';
  if v_status <> 'delivered' or v_fulfillment <> 'fulfilled' or v_delivered is null or v_events <> 3 or v_notifications <> 3 or v_escrow <> 'held' then
    raise exception 'delivered invariant failed: status %, fulfillment %, events %, notifications %, escrow %',v_status,v_fulfillment,v_events,v_notifications,v_escrow;
  end if;
end $$;

-- Timeline is participant-readable but not visible to an unrelated account.
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
do $$ declare v_count integer; begin
  select count(*) into v_count from public.order_fulfillment_events where order_id='b1000000-0000-0000-0000-000000000001';
  if v_count <> 3 then raise exception 'buyer cannot read own fulfillment timeline'; end if;
end $$;
select set_config('request.jwt.claim.sub','a3000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"a3000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
do $$ declare v_count integer; begin
  select count(*) into v_count from public.order_fulfillment_events where order_id='b1000000-0000-0000-0000-000000000001';
  if v_count <> 0 then raise exception 'unrelated seller can read foreign timeline'; end if;
end $$;

-- Prove all-or-nothing rollback by injecting an event-insert failure after the
-- order/item update statements would otherwise have run.
select set_config('request.jwt.claim.sub','a2000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"a2000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select * from public.transition_seller_order('b3000000-0000-0000-0000-000000000003','processing',null,null);
reset role;
create function pg_temp.fail_fulfillment_event_insert() returns trigger language plpgsql as $$
begin
  if new.order_id='b3000000-0000-0000-0000-000000000003'::uuid and new.to_status='shipped' then
    raise exception 'injected_fulfillment_event_failure';
  end if;
  return new;
end $$;
create trigger test_fail_fulfillment_event_insert
before insert on public.order_fulfillment_events
for each row execute function pg_temp.fail_fulfillment_event_insert();

set local role authenticated;
select set_config('request.jwt.claim.sub','a2000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"a2000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
do $$ begin
  begin
    perform * from public.transition_seller_order('b3000000-0000-0000-0000-000000000003','shipped','ROLLBACK-TRACK','Rollback Carrier');
    raise exception 'injected failure did not abort transition';
  exception when others then
    if sqlerrm <> 'injected_fulfillment_event_failure' then raise; end if;
  end;
end $$;
reset role;
drop trigger test_fail_fulfillment_event_insert on public.order_fulfillment_events;

do $$
declare v_status text; v_tracking text; v_item text; v_events integer; v_notifications integer; v_escrow text;
begin
  select status, tracking_number into v_status,v_tracking from public.orders where id='b3000000-0000-0000-0000-000000000003';
  select fulfillment_status into v_item from public.order_items where order_id='b3000000-0000-0000-0000-000000000003';
  select count(*) into v_events from public.order_fulfillment_events where order_id='b3000000-0000-0000-0000-000000000003';
  select count(*) into v_notifications from public.notifications
    where user_id='a1000000-0000-0000-0000-000000000001'
      and metadata->>'order_id'='b3000000-0000-0000-0000-000000000003';
  select status into v_escrow from public.escrow_transactions where order_id='b3000000-0000-0000-0000-000000000003';
  if v_status <> 'processing' or v_tracking is not null or v_item <> 'unfulfilled' or v_events <> 1 or v_notifications <> 1 or v_escrow <> 'held' then
    raise exception 'transaction rollback failed: status %, tracking %, item %, events %, notifications %, escrow %',v_status,v_tracking,v_item,v_events,v_notifications,v_escrow;
  end if;
end $$;

-- service_role cannot mutate the append-only ledger because it has no UPDATE
-- grant. The table owner is independently blocked by the immutability trigger.
set local role service_role;
do $$ begin
  begin
    update public.order_fulfillment_events set metadata='{"tampered":true}' where order_id='b1000000-0000-0000-0000-000000000001';
    raise exception 'service_role unexpectedly mutated immutable fulfillment history';
  exception when sqlstate '42501' then null; end;
end $$;

reset role;
do $$ begin
  begin
    update public.order_fulfillment_events set metadata='{"tampered":true}' where order_id='b1000000-0000-0000-0000-000000000001';
    raise exception 'table owner unexpectedly mutated immutable fulfillment history';
  exception when sqlstate '55000' then null; end;
end $$;

rollback;
select 'Atomic fulfillment authority regression passed' as result;
