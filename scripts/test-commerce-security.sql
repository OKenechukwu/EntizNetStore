\set ON_ERROR_STOP on

-- EntizNetStore P0 commerce/security regression suite.
-- Runs only against the disposable local Supabase database created by CI.
-- All test data is rolled back.

begin;

-- ---------------------------------------------------------------------------
-- Fixture identities and marketplace records
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'buyer1@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'buyer2@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'seller1@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'seller2@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles_buyer(id, display_name)
values
  ('10000000-0000-0000-0000-000000000001', 'P0 Buyer One'),
  ('20000000-0000-0000-0000-000000000002', 'P0 Buyer Two');

insert into public.profiles_seller(id, storefront_name, verification_status)
values
  ('30000000-0000-0000-0000-000000000003', 'P0 Seller One', 'verified'),
  ('40000000-0000-0000-0000-000000000004', 'P0 Seller Two', 'verified');

insert into public.products(
  id, seller_id, title, slug, status, base_price, requires_shipping, marketplace_brand
)
values
  ('50000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000003', 'P0 Product One', 'p0-product-one', 'active', 10.00, true, 'entiznetstore'),
  ('60000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000004', 'P0 Product Two', 'p0-product-two', 'active', 15.00, true, 'entiznetstore');

insert into public.product_variants(
  id, product_id, title, sku, price, track_inventory, inventory_quantity,
  inventory_policy, is_active, position
)
values
  ('51000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000005', 'Default', 'P0-SKU-ONE', 10.00, true, 10, 'deny', true, 0),
  ('61000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000006', 'Default', 'P0-SKU-TWO', 15.00, true, 8, 'deny', true, 0);

-- ---------------------------------------------------------------------------
-- Buyer 1: authenticated checkout; prices must come only from live variants.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select *
from public.create_checkout_session(
  jsonb_build_array(
    jsonb_build_object(
      'productId', '50000000-0000-0000-0000-000000000005',
      'variantId', '51000000-0000-0000-0000-000000000005',
      'quantity', 2,
      'clientPrice', 1
    ),
    jsonb_build_object(
      'productId', '60000000-0000-0000-0000-000000000006',
      'variantId', '61000000-0000-0000-0000-000000000006',
      'quantity', 1,
      'clientPrice', 1
    )
  ),
  jsonb_build_object(
    'name', 'P0 Buyer One',
    'line1', '1 Test Street',
    'city', 'Test City',
    'postal_code', '10000',
    'country', 'US'
  ),
  '70000000-0000-0000-0000-000000000007'
);

do $$
declare
  v_sessions integer;
  v_orders integer;
  v_items integer;
  v_reservations integer;
  v_total bigint;
begin
  select count(*), max(amount_cents)
    into v_sessions, v_total
  from public.payment_sessions
  where buyer_id = auth.uid()
    and idempotency_key = '70000000-0000-0000-0000-000000000007';

  if v_sessions <> 1 or v_total <> 3500 then
    raise exception 'Server price/idempotency foundation failed: sessions %, total %', v_sessions, v_total;
  end if;

  select count(*) into v_orders
  from public.orders
  where buyer_id = auth.uid();
  if v_orders <> 2 then
    raise exception 'Expected checkout to split into 2 seller orders, found %', v_orders;
  end if;

  select count(*) into v_items
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.buyer_id = auth.uid();
  if v_items <> 2 then
    raise exception 'Expected 2 checkout order items, found %', v_items;
  end if;

  select count(*) into v_reservations
  from public.inventory_reservations r
  join public.payment_sessions ps on ps.id = r.payment_session_id
  where ps.buyer_id = auth.uid()
    and r.status = 'pending';
  if v_reservations <> 2 then
    raise exception 'Expected 2 pending inventory reservations, found %', v_reservations;
  end if;
end
$$;

-- Exact retry returns the durable session and must not duplicate anything.
select *
from public.create_checkout_session(
  jsonb_build_array(
    jsonb_build_object(
      'productId', '50000000-0000-0000-0000-000000000005',
      'variantId', '51000000-0000-0000-0000-000000000005',
      'quantity', 2,
      'clientPrice', 1
    ),
    jsonb_build_object(
      'productId', '60000000-0000-0000-0000-000000000006',
      'variantId', '61000000-0000-0000-0000-000000000006',
      'quantity', 1,
      'clientPrice', 1
    )
  ),
  jsonb_build_object(
    'name', 'P0 Buyer One',
    'line1', '1 Test Street',
    'city', 'Test City',
    'postal_code', '10000',
    'country', 'US'
  ),
  '70000000-0000-0000-0000-000000000007'
);

do $$
declare
  v_orders integer;
  v_items integer;
  v_reservations integer;
begin
  select count(*) into v_orders from public.orders where buyer_id = auth.uid();
  select count(*) into v_items
  from public.order_items oi join public.orders o on o.id = oi.order_id
  where o.buyer_id = auth.uid();
  select count(*) into v_reservations
  from public.inventory_reservations r
  join public.payment_sessions ps on ps.id = r.payment_session_id
  where ps.buyer_id = auth.uid();

  if v_orders <> 2 or v_items <> 2 or v_reservations <> 2 then
    raise exception 'Idempotent retry duplicated commerce records: orders %, items %, reservations %',
      v_orders, v_items, v_reservations;
  end if;
end
$$;

-- Same key + changed cart must be rejected rather than charging stale totals.
do $$
begin
  begin
    perform *
    from public.create_checkout_session(
      jsonb_build_array(
        jsonb_build_object(
          'productId', '50000000-0000-0000-0000-000000000005',
          'variantId', '51000000-0000-0000-0000-000000000005',
          'quantity', 3
        )
      ),
      jsonb_build_object('line1', '1 Test Street'),
      '70000000-0000-0000-0000-000000000007'
    );
    raise exception 'Expected idempotency/cart mismatch to be rejected';
  exception
    when sqlstate '22023' then
      if sqlerrm not like 'Idempotency key was already used%' then
        raise;
      end if;
  end;
end
$$;

select public.attach_checkout_payment_intent(
  (
    select id from public.payment_sessions
    where buyer_id = auth.uid()
      and idempotency_key = '70000000-0000-0000-0000-000000000007'
  ),
  'pi_p0_checkout_one'
);

-- A different buyer must not be able to attach/cancel Buyer 1's checkout.
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

do $$
declare
  v_target uuid;
begin
  -- Security-definer lookup is deliberately simulated with the known test key
  -- through a role-safe subquery executed before the restricted operation.
  reset role;
  select id into v_target
  from public.payment_sessions
  where idempotency_key = '70000000-0000-0000-0000-000000000007';
  set local role authenticated;

  begin
    perform public.cancel_checkout_session(v_target);
    raise exception 'Cross-account checkout cancellation unexpectedly succeeded';
  exception when sqlstate '42501' then
    null;
  end;
end
$$;

-- Restore Buyer 1 claims for later visibility assertions.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

-- ---------------------------------------------------------------------------
-- Stripe webhook ordering/replay: failed -> succeeded -> replay -> late failed.
-- ---------------------------------------------------------------------------
reset role;
set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select public.finalize_checkout_payment(
  'evt_p0_failed_first',
  'payment_intent.payment_failed',
  (select id from public.payment_sessions where idempotency_key = '70000000-0000-0000-0000-000000000007'),
  'pi_p0_checkout_one',
  false
);

do $$
declare
  v_status text;
  v_pending integer;
  v_order_pending integer;
  v_stock1 integer;
  v_stock2 integer;
begin
  select status into v_status
  from public.payment_sessions
  where idempotency_key = '70000000-0000-0000-0000-000000000007';
  select count(*) into v_pending
  from public.inventory_reservations r
  join public.payment_sessions ps on ps.id = r.payment_session_id
  where ps.idempotency_key = '70000000-0000-0000-0000-000000000007'
    and r.status = 'pending';
  select count(*) into v_order_pending
  from public.orders o
  join public.payment_sessions ps on ps.id = o.payment_session_id
  where ps.idempotency_key = '70000000-0000-0000-0000-000000000007'
    and o.payment_status = 'pending';
  select inventory_quantity into v_stock1 from public.product_variants where id = '51000000-0000-0000-0000-000000000005';
  select inventory_quantity into v_stock2 from public.product_variants where id = '61000000-0000-0000-0000-000000000006';

  if v_status <> 'requires_payment' or v_pending <> 2 or v_order_pending <> 2 then
    raise exception 'Transient payment failure destroyed payable checkout state: status %, reservations %, orders %',
      v_status, v_pending, v_order_pending;
  end if;
  if v_stock1 <> 10 or v_stock2 <> 8 then
    raise exception 'Inventory changed on payment failure: stock1 %, stock2 %', v_stock1, v_stock2;
  end if;
end
$$;

select public.finalize_checkout_payment(
  'evt_p0_succeeded',
  'payment_intent.succeeded',
  (select id from public.payment_sessions where idempotency_key = '70000000-0000-0000-0000-000000000007'),
  'pi_p0_checkout_one',
  true
);

do $$
declare
  v_status text;
  v_paid_orders integer;
  v_consumed integer;
  v_escrow integer;
  v_stock1 integer;
  v_stock2 integer;
begin
  select status into v_status
  from public.payment_sessions
  where idempotency_key = '70000000-0000-0000-0000-000000000007';
  select count(*) into v_paid_orders
  from public.orders o
  join public.payment_sessions ps on ps.id = o.payment_session_id
  where ps.idempotency_key = '70000000-0000-0000-0000-000000000007'
    and o.status = 'confirmed'
    and o.payment_status = 'paid';
  select count(*) into v_consumed
  from public.inventory_reservations r
  join public.payment_sessions ps on ps.id = r.payment_session_id
  where ps.idempotency_key = '70000000-0000-0000-0000-000000000007'
    and r.status = 'consumed';
  select count(*) into v_escrow
  from public.escrow_transactions e
  join public.orders o on o.id = e.order_id
  join public.payment_sessions ps on ps.id = o.payment_session_id
  where ps.idempotency_key = '70000000-0000-0000-0000-000000000007'
    and e.status = 'held';
  select inventory_quantity into v_stock1 from public.product_variants where id = '51000000-0000-0000-0000-000000000005';
  select inventory_quantity into v_stock2 from public.product_variants where id = '61000000-0000-0000-0000-000000000006';

  if v_status <> 'paid' or v_paid_orders <> 2 or v_consumed <> 2 or v_escrow <> 2 then
    raise exception 'Payment success finalization incomplete: status %, paid orders %, consumed %, escrow %',
      v_status, v_paid_orders, v_consumed, v_escrow;
  end if;
  if v_stock1 <> 8 or v_stock2 <> 7 then
    raise exception 'Server inventory consumption is wrong: stock1 %, stock2 %', v_stock1, v_stock2;
  end if;
end
$$;

-- Exact event replay must return false and must not consume stock twice.
do $$
declare
  v_processed boolean;
  v_stock1 integer;
  v_stock2 integer;
begin
  select public.finalize_checkout_payment(
    'evt_p0_succeeded',
    'payment_intent.succeeded',
    (select id from public.payment_sessions where idempotency_key = '70000000-0000-0000-0000-000000000007'),
    'pi_p0_checkout_one',
    true
  ) into v_processed;

  if v_processed then
    raise exception 'Exact Stripe webhook replay was not deduplicated';
  end if;

  select inventory_quantity into v_stock1 from public.product_variants where id = '51000000-0000-0000-0000-000000000005';
  select inventory_quantity into v_stock2 from public.product_variants where id = '61000000-0000-0000-0000-000000000006';
  if v_stock1 <> 8 or v_stock2 <> 7 then
    raise exception 'Webhook replay consumed inventory twice';
  end if;
end
$$;

-- A distinct late failure event must never downgrade a paid checkout.
select public.finalize_checkout_payment(
  'evt_p0_failed_late',
  'payment_intent.payment_failed',
  (select id from public.payment_sessions where idempotency_key = '70000000-0000-0000-0000-000000000007'),
  'pi_p0_checkout_one',
  false
);

do $$
declare
  v_session_status text;
  v_bad_orders integer;
begin
  select status into v_session_status
  from public.payment_sessions
  where idempotency_key = '70000000-0000-0000-0000-000000000007';
  select count(*) into v_bad_orders
  from public.orders o
  join public.payment_sessions ps on ps.id = o.payment_session_id
  where ps.idempotency_key = '70000000-0000-0000-0000-000000000007'
    and (o.status <> 'confirmed' or o.payment_status <> 'paid');

  if v_session_status <> 'paid' or v_bad_orders <> 0 then
    raise exception 'Late failure event downgraded paid commerce state';
  end if;
end
$$;

-- Event/outcome spoofing must be rejected even from the service-role RPC path.
do $$
begin
  begin
    perform public.finalize_checkout_payment(
      'evt_p0_mismatched_type',
      'payment_intent.payment_failed',
      (select id from public.payment_sessions where idempotency_key = '70000000-0000-0000-0000-000000000007'),
      'pi_p0_checkout_one',
      true
    );
    raise exception 'Event type/outcome mismatch unexpectedly succeeded';
  exception when sqlstate '22023' then
    null;
  end;
end
$$;

-- ---------------------------------------------------------------------------
-- Seller fulfillment ownership and transition state machine
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"40000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

-- Seller 2 cannot mutate Seller 1's order.
do $$
declare
  v_foreign_order uuid;
begin
  reset role;
  select id into v_foreign_order
  from public.orders
  where seller_id = '30000000-0000-0000-0000-000000000003'
  limit 1;
  set local role authenticated;

  begin
    perform public.transition_seller_order(v_foreign_order, 'processing', null, null);
    raise exception 'Cross-seller fulfillment unexpectedly succeeded';
  exception when sqlstate '42501' then
    null;
  end;
end
$$;

-- Seller 1 can advance only through the allowed paid fulfillment sequence.
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select public.transition_seller_order(
  (select id from public.orders where seller_id = auth.uid() limit 1),
  'processing', null, null
);

do $$
begin
  begin
    perform public.transition_seller_order(
      (select id from public.orders where seller_id = auth.uid() limit 1),
      'shipped', null, null
    );
    raise exception 'Shipping without carrier/tracking unexpectedly succeeded';
  exception when sqlstate '22023' then
    null;
  end;
end
$$;

select public.transition_seller_order(
  (select id from public.orders where seller_id = auth.uid() limit 1),
  'shipped', 'TRACK-P0-001', 'P0 Carrier'
);
select public.transition_seller_order(
  (select id from public.orders where seller_id = auth.uid() limit 1),
  'delivered', null, null
);

do $$
declare
  v_status text;
  v_fulfillment text;
  v_tracking text;
begin
  select status, fulfillment_status, tracking_number
    into v_status, v_fulfillment, v_tracking
  from public.orders
  where seller_id = auth.uid()
  limit 1;

  if v_status <> 'delivered' or v_fulfillment <> 'fulfilled' or v_tracking <> 'TRACK-P0-001' then
    raise exception 'Seller fulfillment transition state is incorrect';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Buyer 2 cancellation: releases inventory and terminal sessions stay terminal.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select *
from public.create_checkout_session(
  jsonb_build_array(
    jsonb_build_object(
      'productId', '50000000-0000-0000-0000-000000000005',
      'variantId', '51000000-0000-0000-0000-000000000005',
      'quantity', 1
    )
  ),
  jsonb_build_object(
    'name', 'P0 Buyer Two',
    'line1', '2 Test Street',
    'city', 'Test City',
    'postal_code', '10000',
    'country', 'US'
  ),
  '80000000-0000-0000-0000-000000000008'
);

select public.attach_checkout_payment_intent(
  (select id from public.payment_sessions where buyer_id = auth.uid() and idempotency_key = '80000000-0000-0000-0000-000000000008'),
  'pi_p0_checkout_cancelled'
);
select public.cancel_checkout_session(
  (select id from public.payment_sessions where buyer_id = auth.uid() and idempotency_key = '80000000-0000-0000-0000-000000000008')
);

do $$
declare
  v_status text;
  v_released integer;
  v_cancelled_orders integer;
begin
  select status into v_status
  from public.payment_sessions
  where buyer_id = auth.uid()
    and idempotency_key = '80000000-0000-0000-0000-000000000008';
  select count(*) into v_released
  from public.inventory_reservations r
  join public.payment_sessions ps on ps.id = r.payment_session_id
  where ps.buyer_id = auth.uid()
    and ps.idempotency_key = '80000000-0000-0000-0000-000000000008'
    and r.status = 'released';
  select count(*) into v_cancelled_orders
  from public.orders o
  join public.payment_sessions ps on ps.id = o.payment_session_id
  where ps.buyer_id = auth.uid()
    and ps.idempotency_key = '80000000-0000-0000-0000-000000000008'
    and o.status = 'cancelled'
    and o.payment_status = 'failed';

  if v_status <> 'cancelled' or v_released <> 1 or v_cancelled_orders <> 1 then
    raise exception 'Checkout cancellation did not release/terminalize state safely';
  end if;
end
$$;

-- A success callback against an explicitly cancelled checkout is an incident,
-- not permission to recreate stock/order state silently.
reset role;
set local role service_role;
do $$
begin
  begin
    perform public.finalize_checkout_payment(
      'evt_p0_cancelled_success',
      'payment_intent.succeeded',
      (select id from public.payment_sessions where idempotency_key = '80000000-0000-0000-0000-000000000008'),
      'pi_p0_checkout_cancelled',
      true
    );
    raise exception 'Cancelled checkout unexpectedly accepted a success event';
  exception when others then
    if sqlerrm not like 'Checkout session is no longer payable%' then
      raise;
    end if;
  end;
end
$$;

-- ---------------------------------------------------------------------------
-- Representative RLS visibility boundaries
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

do $$
declare
  v_orders integer;
  v_sessions integer;
begin
  select count(*) into v_orders from public.orders;
  select count(*) into v_sessions from public.payment_sessions;
  if v_orders <> 2 or v_sessions <> 1 then
    raise exception 'Buyer 1 RLS visibility incorrect: orders %, sessions %', v_orders, v_sessions;
  end if;
end
$$;

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

do $$
declare
  v_orders integer;
  v_sessions integer;
begin
  select count(*) into v_orders from public.orders;
  select count(*) into v_sessions from public.payment_sessions;
  if v_orders <> 1 or v_sessions <> 1 then
    raise exception 'Buyer 2 RLS visibility incorrect: orders %, sessions %', v_orders, v_sessions;
  end if;
end
$$;

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

do $$
declare v_orders integer;
begin
  select count(*) into v_orders from public.orders;
  if v_orders <> 2 then
    -- Seller 1 owns Buyer 1's paid order and Buyer 2's cancelled order.
    raise exception 'Seller 1 RLS visibility incorrect: orders %', v_orders;
  end if;
end
$$;

select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"40000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

do $$
declare v_orders integer;
begin
  select count(*) into v_orders from public.orders;
  if v_orders <> 1 then
    raise exception 'Seller 2 RLS visibility incorrect: orders %', v_orders;
  end if;
end
$$;

reset role;
rollback;

select 'EntizNetStore P0 commerce/security regression suite passed' as result;
