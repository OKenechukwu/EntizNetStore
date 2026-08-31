\set ON_ERROR_STOP on

-- M3 persistent cart/address/quote/checkout authorization regression suite.
-- Runs against the disposable fresh Supabase CI database and rolls back.
-- Generated IDs captured by psql are copied into session-scoped custom GUCs
-- before PL/pgSQL blocks because psql variables are not expanded inside $$.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'm3-buyer-one@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'm3-buyer-two@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a3000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'm3-seller@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles_buyer(id, display_name)
values
  ('a1000000-0000-0000-0000-000000000001', 'M3 Buyer One'),
  ('a2000000-0000-0000-0000-000000000002', 'M3 Buyer Two'),
  ('a3000000-0000-0000-0000-000000000003', 'M3 Seller');

insert into public.profiles_seller(
  id, storefront_name, business_type, verification_status,
  return_policy, shipping_policy
)
values (
  'a3000000-0000-0000-0000-000000000003',
  'M3 Seller Store', 'individual', 'verified',
  'Returns accepted under the test marketplace policy.',
  'Shipping is configured for the test Seller.'
);

insert into public.products(
  id, seller_id, title, slug, description, type, status,
  moderation_status, base_price, requires_shipping, is_taxable,
  marketplace_brand
)
values (
  'a4000000-0000-0000-0000-000000000004',
  'a3000000-0000-0000-0000-000000000003',
  'M3 Digital Product', 'm3-digital-product', 'M3 regression product',
  'digital', 'draft', 'not_submitted', 25.00, false, false, 'entiznetstore'
);

insert into public.product_variants(
  id, product_id, title, sku, price, track_inventory,
  inventory_quantity, inventory_policy, requires_shipping, is_active, position
)
values (
  'a5000000-0000-0000-0000-000000000005',
  'a4000000-0000-0000-0000-000000000004',
  'Default', 'M3-DIGITAL', 25.00, true, 5, 'deny', false, true, 0
);

insert into public.product_categories(product_id, category_id)
values (
  'a4000000-0000-0000-0000-000000000004',
  'b9ec6994-3765-4a06-a072-6bcf6b619645'
);

insert into public.product_media(product_id, type, url, position)
values (
  'a4000000-0000-0000-0000-000000000004',
  'image', 'https://example.invalid/m3-product.webp', 0
);

update public.products
set moderation_status = 'approved', status = 'active', moderated_at = now(), updated_at = now()
where id = 'a4000000-0000-0000-0000-000000000004';

-- Browser roles cannot use the legacy arbitrary-item checkout RPC anymore.
do $$
begin
  if has_function_privilege(
    'authenticated',
    'public.create_checkout_session(jsonb,jsonb,uuid)',
    'EXECUTE'
  ) then
    raise exception 'authenticated can still execute legacy create_checkout_session';
  end if;
  if has_function_privilege(
    'anon',
    'public.create_checkout_session_v2(uuid,uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'anon can execute create_checkout_session_v2';
  end if;
  if not has_function_privilege(
    'authenticated',
    'public.create_checkout_session_v2(uuid,uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'authenticated cannot execute create_checkout_session_v2';
  end if;
end
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select public.buyer_save_address(
  null, 'Home', true, 'shipping', 'M3', 'Buyer', null,
  '1 Test Street', null, 'Test City', 'Test Province', '1000', 'PH', '+630000000000'
) as address_id \gset
select set_config('m3.address_id', :'address_id', false);

-- Direct address/cart mutation is forbidden even for the owner.
do $$
begin
  begin
    update public.addresses
    set city = 'Bypass City'
    where id = current_setting('m3.address_id')::uuid;
    raise exception 'Buyer unexpectedly bypassed address RPC boundary';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.carts(buyer_id)
    values ('a1000000-0000-0000-0000-000000000001');
    raise exception 'Buyer unexpectedly bypassed cart RPC boundary';
  exception when insufficient_privilege then null;
  end;
end
$$;

select public.buyer_get_or_create_cart() as cart_id \gset
select set_config('m3.cart_id', :'cart_id', false);
select public.buyer_get_or_create_cart() as cart_id_replay \gset
select set_config('m3.cart_id_replay', :'cart_id_replay', false);

do $$
begin
  if current_setting('m3.cart_id') <> current_setting('m3.cart_id_replay') then
    raise exception 'buyer_get_or_create_cart did not preserve one active cart';
  end if;
end
$$;

select public.buyer_set_cart_item(
  'a4000000-0000-0000-0000-000000000004',
  'a5000000-0000-0000-0000-000000000005',
  2
) as cart_item_id \gset
select set_config('m3.cart_item_id', :'cart_item_id', false);

reset role;
select version as cart_version from public.carts where id = :'cart_id'::uuid \gset
select set_config('m3.cart_version', :'cart_version', false);

do $$
begin
  if current_setting('m3.cart_version')::bigint <= 1 then
    raise exception 'Cart mutation did not increment version';
  end if;
  if (
    select count(*)
    from public.carts
    where buyer_id = 'a1000000-0000-0000-0000-000000000001'
      and status = 'active'
  ) <> 1 then
    raise exception 'Buyer has more than one active cart';
  end if;
end
$$;

-- Another Buyer cannot see address/cart/item rows or mutate Buyer One's item.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

do $$
begin
  if (
    select count(*) from public.addresses
    where id = current_setting('m3.address_id')::uuid
  ) <> 0 then
    raise exception 'Cross-Buyer address leaked through RLS';
  end if;
  if (
    select count(*) from public.carts
    where id = current_setting('m3.cart_id')::uuid
  ) <> 0 then
    raise exception 'Cross-Buyer cart leaked through RLS';
  end if;
  if (
    select count(*) from public.cart_items
    where id = current_setting('m3.cart_item_id')::uuid
  ) <> 0 then
    raise exception 'Cross-Buyer cart item leaked through RLS';
  end if;

  begin
    perform public.buyer_remove_cart_item(current_setting('m3.cart_item_id')::uuid);
    raise exception 'Cross-Buyer cart-item mutation unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- Inventory is rechecked on every cart mutation. A cart itself does not reserve
-- stock, so a later inventory drop can make a requested quantity unavailable.
reset role;
update public.product_variants
set inventory_quantity = 1
where id = 'a5000000-0000-0000-0000-000000000005';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

do $$
begin
  begin
    perform public.buyer_set_cart_item(
      'a4000000-0000-0000-0000-000000000004',
      'a5000000-0000-0000-0000-000000000005',
      2
    );
    raise exception 'Insufficient inventory cart update unexpectedly succeeded';
  exception when sqlstate '22023' then null;
  end;
end
$$;

reset role;
update public.product_variants
set inventory_quantity = 5
where id = 'a5000000-0000-0000-0000-000000000005';

-- Browser users cannot manufacture a trusted quote row.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

do $$
begin
  begin
    insert into public.cart_quotes(
      cart_id, buyer_id, cart_version, status, subtotal_cents, total_cents,
      items_snapshot, seller_totals, expires_at
    ) values (
      current_setting('m3.cart_id')::uuid,
      'a1000000-0000-0000-0000-000000000001',
      current_setting('m3.cart_version')::bigint,
      'ready', 1, 1, '[]'::jsonb, '{}'::jsonb, now() + interval '15 minutes'
    );
    raise exception 'Buyer unexpectedly inserted trusted cart quote directly';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- Trusted server quote fixture for the current cart version.
reset role;
insert into public.cart_quotes(
  id, cart_id, buyer_id, cart_version, status, block_reasons, currency,
  subtotal_cents, tax_cents, shipping_cents, discount_cents, total_cents,
  shipping_address, shipping_quote, tax_quote, items_snapshot, seller_totals,
  expires_at
)
values (
  'a6000000-0000-0000-0000-000000000006',
  :'cart_id'::uuid,
  'a1000000-0000-0000-0000-000000000001',
  :'cart_version'::bigint,
  'ready', '{}'::text[], 'usd', 5000, 0, 0, 0, 5000,
  null,
  '{"provider":"internal","status":"not_required","amountCents":0}'::jsonb,
  '{"provider":"internal","status":"not_required","amountCents":0}'::jsonb,
  jsonb_build_array(jsonb_build_object(
    'cartItemId', :'cart_item_id'::uuid,
    'productId', 'a4000000-0000-0000-0000-000000000004',
    'variantId', 'a5000000-0000-0000-0000-000000000005',
    'sellerId', 'a3000000-0000-0000-0000-000000000003',
    'title', 'M3 Digital Product',
    'variantTitle', 'Default',
    'sku', 'M3-DIGITAL',
    'quantity', 2,
    'unitPriceCents', 2500,
    'lineTotalCents', 5000,
    'requiresShipping', false,
    'isTaxable', false,
    'available', true
  )),
  jsonb_build_object(
    'a3000000-0000-0000-0000-000000000003',
    jsonb_build_object(
      'subtotalCents', 5000,
      'taxCents', 0,
      'shippingCents', 0,
      'discountCents', 0,
      'totalCents', 5000
    )
  ),
  now() + interval '15 minutes'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select * from public.create_checkout_session_v2(
  :'cart_id'::uuid,
  'a6000000-0000-0000-0000-000000000006',
  'a7000000-0000-0000-0000-000000000007'
) \gset
select set_config('m3.session_id', :'session_id', false);
select set_config('m3.amount_cents', :'amount_cents', false);

do $$
declare
  v_quote_status text;
  v_orders integer;
  v_items integer;
  v_reservations integer;
begin
  select status into v_quote_status
  from public.cart_quotes
  where id = 'a6000000-0000-0000-0000-000000000006';

  select count(*) into v_orders
  from public.orders
  where payment_session_id = current_setting('m3.session_id')::uuid;

  select count(*) into v_items
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.payment_session_id = current_setting('m3.session_id')::uuid;

  select count(*) into v_reservations
  from public.inventory_reservations
  where payment_session_id = current_setting('m3.session_id')::uuid
    and status = 'pending';

  if current_setting('m3.amount_cents')::bigint <> 5000
     or v_quote_status <> 'consumed'
     or v_orders <> 1 or v_items <> 1 or v_reservations <> 1 then
    raise exception 'Trusted checkout freeze failed: amount %, quote %, orders %, items %, reservations %',
      current_setting('m3.amount_cents'), v_quote_status, v_orders, v_items, v_reservations;
  end if;
end
$$;

-- Exact idempotent replay of a consumed quote returns the same internal session.
select * from public.create_checkout_session_v2(
  :'cart_id'::uuid,
  'a6000000-0000-0000-0000-000000000006',
  'a7000000-0000-0000-0000-000000000007'
) \gset replay_
select set_config('m3.replay_session_id', :'replay_session_id', false);
select set_config('m3.replay_amount_cents', :'replay_amount_cents', false);

do $$
begin
  if current_setting('m3.replay_session_id') <> current_setting('m3.session_id')
     or current_setting('m3.replay_amount_cents')::bigint <> 5000 then
    raise exception 'Checkout v2 idempotent replay changed session or amount';
  end if;
end
$$;

-- Create another quote, then mutate the cart. The older quote must become stale.
reset role;
insert into public.cart_quotes(
  id, cart_id, buyer_id, cart_version, status, subtotal_cents, total_cents,
  items_snapshot, seller_totals, expires_at
)
select
  'a8000000-0000-0000-0000-000000000008',
  id, buyer_id, version, 'ready', 5000, 5000,
  (select items_snapshot from public.cart_quotes where id = 'a6000000-0000-0000-0000-000000000006'),
  (select seller_totals from public.cart_quotes where id = 'a6000000-0000-0000-0000-000000000006'),
  now() + interval '15 minutes'
from public.carts
where id = :'cart_id'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select public.buyer_set_cart_item(
  'a4000000-0000-0000-0000-000000000004',
  'a5000000-0000-0000-0000-000000000005',
  1
);

do $$
begin
  begin
    perform * from public.create_checkout_session_v2(
      current_setting('m3.cart_id')::uuid,
      'a8000000-0000-0000-0000-000000000008',
      'a9000000-0000-0000-0000-000000000009'
    );
    raise exception 'Stale cart quote unexpectedly created a checkout';
  exception when sqlstate '22023' then null;
  end;
end
$$;

-- Final payment success consumes reserved inventory, confirms the order and
-- converts only the cart captured in the payment-session metadata. Payment
-- provider identity is now established only through the service initialization
-- claim/attach authority, matching the production route.
reset role;
set local role service_role;
select public.service_claim_checkout_payment_initialization(
  :'session_id'::uuid,
  'a1000000-0000-0000-0000-000000000001',
  'aa000000-0000-0000-0000-00000000000a'
);
select public.service_attach_checkout_payment_reference(
  :'session_id'::uuid,
  'a1000000-0000-0000-0000-000000000001',
  'aa000000-0000-0000-0000-00000000000a',
  'm3test',
  'm3-provider-payment-1'
);
select public.finalize_checkout_payment_v2(
  'm3-event-1',
  'payment.succeeded',
  :'session_id'::uuid,
  'm3test',
  'm3-provider-payment-1',
  'succeeded'
);

reset role;
do $$
declare
  v_cart_status text;
  v_session_status text;
  v_order_status text;
  v_payment_status text;
  v_inventory integer;
begin
  select status into v_cart_status
  from public.carts
  where id = current_setting('m3.cart_id')::uuid;

  select status into v_session_status
  from public.payment_sessions
  where id = current_setting('m3.session_id')::uuid;

  select status, payment_status into v_order_status, v_payment_status
  from public.orders
  where payment_session_id = current_setting('m3.session_id')::uuid;

  select inventory_quantity into v_inventory
  from public.product_variants
  where id = 'a5000000-0000-0000-0000-000000000005';

  if v_cart_status <> 'converted' or v_session_status <> 'paid'
     or v_order_status <> 'confirmed' or v_payment_status <> 'paid'
     or v_inventory <> 3 then
    raise exception 'Payment success did not finalize M3 checkout correctly: cart %, session %, order %, payment %, inventory %',
      v_cart_status, v_session_status, v_order_status, v_payment_status, v_inventory;
  end if;
end
$$;

rollback;

select 'M3 cart and order core regression suite passed' as result;
