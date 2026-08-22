\set ON_ERROR_STOP on

-- Provider-neutral payment contract regression suite.
-- Runs only against the disposable local Supabase database created by CI.
-- No external processor/network call is required; all fixture data is rolled back.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'provider-buyer@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '82000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'provider-seller@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles_buyer(id, display_name)
values ('81000000-0000-0000-0000-000000000001', 'Provider Buyer');

insert into public.profiles_seller(
  id, storefront_name, verification_status, return_policy, shipping_policy
)
values (
  '82000000-0000-0000-0000-000000000002',
  'Provider Seller',
  'verified',
  'Returns accepted within 14 days for eligible unused items.',
  'Tracked shipping is dispatched within three business days.'
);

-- This fixture represents a listing that already passed M2 moderation. This
-- suite validates the payment-provider contract rather than product review.
insert into public.products(
  id, seller_id, title, slug, status, moderation_status, base_price, requires_shipping, marketplace_brand
)
values (
  '83000000-0000-0000-0000-000000000003',
  '82000000-0000-0000-0000-000000000002',
  'Provider Contract Product',
  'provider-contract-product',
  'active',
  'approved',
  12.00,
  true,
  'entiznetstore'
);

insert into public.product_variants(
  id, product_id, title, sku, price, track_inventory, inventory_quantity,
  inventory_policy, is_active, position
)
values (
  '84000000-0000-0000-0000-000000000004',
  '83000000-0000-0000-0000-000000000003',
  'Default',
  'PROVIDER-SKU',
  12.00,
  true,
  5,
  'deny',
  true,
  0
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

-- Session 1: normalized retryable failure -> success -> exact replay -> late terminal event.
select *
from public.create_checkout_session(
  jsonb_build_array(
    jsonb_build_object(
      'productId', '83000000-0000-0000-0000-000000000003',
      'variantId', '84000000-0000-0000-0000-000000000004',
      'quantity', 2
    )
  ),
  jsonb_build_object(
    'name', 'Provider Buyer',
    'line1', '1 Provider Street',
    'city', 'Test City',
    'postal_code', '10000',
    'country', 'US'
  ),
  '85000000-0000-0000-0000-000000000005'
);

select public.attach_checkout_payment_reference(
  (
    select id from public.payment_sessions
    where idempotency_key = '85000000-0000-0000-0000-000000000005'
  ),
  'simulator',
  'sim_pay_success_path'
);

do $$
declare
  v_provider text;
  v_payment text;
  v_status text;
  v_total bigint;
begin
  select payment_provider, provider_payment_id, status, amount_cents
    into v_provider, v_payment, v_status, v_total
  from public.payment_sessions
  where idempotency_key = '85000000-0000-0000-0000-000000000005';

  if v_provider <> 'simulator'
     or v_payment <> 'sim_pay_success_path'
     or v_status <> 'requires_payment'
     or v_total <> 2400 then
    raise exception 'Generic payment attachment failed: provider %, payment %, status %, total %',
      v_provider, v_payment, v_status, v_total;
  end if;
end
$$;

reset role;
set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select public.finalize_checkout_payment_v2(
  'evt_retryable',
  'simulator.payment.retryable_failure',
  (select id from public.payment_sessions where idempotency_key = '85000000-0000-0000-0000-000000000005'),
  'simulator',
  'sim_pay_success_path',
  'retryable_failure'
);

do $$
declare
  v_status text;
  v_pending integer;
  v_stock integer;
begin
  select status into v_status
  from public.payment_sessions
  where idempotency_key = '85000000-0000-0000-0000-000000000005';

  select count(*) into v_pending
  from public.inventory_reservations r
  join public.payment_sessions ps on ps.id = r.payment_session_id
  where ps.idempotency_key = '85000000-0000-0000-0000-000000000005'
    and r.status = 'pending';

  select inventory_quantity into v_stock
  from public.product_variants
  where id = '84000000-0000-0000-0000-000000000004';

  if v_status <> 'requires_payment' or v_pending <> 1 or v_stock <> 5 then
    raise exception 'Retryable failure did not preserve payable state: status %, pending %, stock %',
      v_status, v_pending, v_stock;
  end if;
end
$$;

select public.finalize_checkout_payment_v2(
  'evt_succeeded',
  'simulator.payment.succeeded',
  (select id from public.payment_sessions where idempotency_key = '85000000-0000-0000-0000-000000000005'),
  'simulator',
  'sim_pay_success_path',
  'succeeded'
);

do $$
declare
  v_status text;
  v_paid integer;
  v_consumed integer;
  v_escrow integer;
  v_stock integer;
begin
  select status into v_status
  from public.payment_sessions
  where idempotency_key = '85000000-0000-0000-0000-000000000005';

  select count(*) into v_paid
  from public.orders o
  join public.payment_sessions ps on ps.id = o.payment_session_id
  where ps.idempotency_key = '85000000-0000-0000-0000-000000000005'
    and o.status = 'confirmed'
    and o.payment_status = 'paid';

  select count(*) into v_consumed
  from public.inventory_reservations r
  join public.payment_sessions ps on ps.id = r.payment_session_id
  where ps.idempotency_key = '85000000-0000-0000-0000-000000000005'
    and r.status = 'consumed';

  select count(*) into v_escrow
  from public.escrow_transactions e
  join public.orders o on o.id = e.order_id
  join public.payment_sessions ps on ps.id = o.payment_session_id
  where ps.idempotency_key = '85000000-0000-0000-0000-000000000005'
    and e.status = 'held';

  select inventory_quantity into v_stock
  from public.product_variants
  where id = '84000000-0000-0000-0000-000000000004';

  if v_status <> 'paid' or v_paid <> 1 or v_consumed <> 1 or v_escrow <> 1 or v_stock <> 3 then
    raise exception 'Provider-neutral success finalization failed: status %, paid %, consumed %, escrow %, stock %',
      v_status, v_paid, v_consumed, v_escrow, v_stock;
  end if;
end
$$;

do $$
declare
  v_processed boolean;
  v_stock integer;
begin
  select public.finalize_checkout_payment_v2(
    'evt_succeeded',
    'simulator.payment.succeeded',
    (select id from public.payment_sessions where idempotency_key = '85000000-0000-0000-0000-000000000005'),
    'simulator',
    'sim_pay_success_path',
    'succeeded'
  ) into v_processed;

  select inventory_quantity into v_stock
  from public.product_variants
  where id = '84000000-0000-0000-0000-000000000004';

  if v_processed is distinct from false or v_stock <> 3 then
    raise exception 'Provider replay protection failed: processed %, stock %', v_processed, v_stock;
  end if;
end
$$;

select public.finalize_checkout_payment_v2(
  'evt_late_terminal',
  'simulator.payment.terminal_failure',
  (select id from public.payment_sessions where idempotency_key = '85000000-0000-0000-0000-000000000005'),
  'simulator',
  'sim_pay_success_path',
  'terminal_failure'
);

do $$
declare
  v_status text;
  v_provider_events integer;
begin
  select status into v_status
  from public.payment_sessions
  where idempotency_key = '85000000-0000-0000-0000-000000000005';

  select count(*) into v_provider_events
  from public.payment_webhook_events
  where provider = 'simulator'
    and event_id like 'simulator:%';

  if v_status <> 'paid' or v_provider_events <> 3 then
    raise exception 'Late terminal-event protection/provider audit failed: status %, events %',
      v_status, v_provider_events;
  end if;
end
$$;

do $$
begin
  begin
    perform public.finalize_checkout_payment_v2(
      'evt_wrong_provider',
      'other.payment.succeeded',
      (select id from public.payment_sessions where idempotency_key = '85000000-0000-0000-0000-000000000005'),
      'other',
      'sim_pay_success_path',
      'succeeded'
    );
    raise exception 'Cross-provider finalization unexpectedly succeeded';
  exception when sqlstate '22023' then
    if sqlerrm not like 'Provider payment reference does not match%' then
      raise;
    end if;
  end;
end
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select *
from public.create_checkout_session(
  jsonb_build_array(
    jsonb_build_object(
      'productId', '83000000-0000-0000-0000-000000000003',
      'variantId', '84000000-0000-0000-0000-000000000004',
      'quantity', 1
    )
  ),
  jsonb_build_object(
    'name', 'Provider Buyer',
    'line1', '1 Provider Street',
    'city', 'Test City',
    'postal_code', '10000',
    'country', 'US'
  ),
  '86000000-0000-0000-0000-000000000006'
);

select public.attach_checkout_payment_reference(
  (select id from public.payment_sessions where idempotency_key = '86000000-0000-0000-0000-000000000006'),
  'simulator',
  'sim_pay_terminal_path'
);

reset role;
set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select public.finalize_checkout_payment_v2(
  'evt_terminal',
  'simulator.payment.terminal_failure',
  (select id from public.payment_sessions where idempotency_key = '86000000-0000-0000-0000-000000000006'),
  'simulator',
  'sim_pay_terminal_path',
  'terminal_failure'
);

do $$
declare
  v_status text;
  v_released integer;
  v_cancelled integer;
  v_stock integer;
begin
  select status into v_status
  from public.payment_sessions
  where idempotency_key = '86000000-0000-0000-0000-000000000006';

  select count(*) into v_released
  from public.inventory_reservations r
  join public.payment_sessions ps on ps.id = r.payment_session_id
  where ps.idempotency_key = '86000000-0000-0000-0000-000000000006'
    and r.status = 'released';

  select count(*) into v_cancelled
  from public.orders o
  join public.payment_sessions ps on ps.id = o.payment_session_id
  where ps.idempotency_key = '86000000-0000-0000-0000-000000000006'
    and o.status = 'cancelled'
    and o.payment_status = 'failed';

  select inventory_quantity into v_stock
  from public.product_variants
  where id = '84000000-0000-0000-0000-000000000004';

  if v_status <> 'failed' or v_released <> 1 or v_cancelled <> 1 or v_stock <> 3 then
    raise exception 'Terminal provider failure cleanup failed: status %, released %, cancelled %, stock %',
      v_status, v_released, v_cancelled, v_stock;
  end if;
end
$$;

do $$
begin
  if has_function_privilege(
    'authenticated',
    'public.finalize_checkout_payment_v2(text,text,uuid,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated role can execute provider finalizer';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.finalize_checkout_payment_v2(text,text,uuid,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'Service role cannot execute provider finalizer';
  end if;
end
$$;

rollback;

\echo 'EntizNetStore provider-neutral payment regression suite passed'