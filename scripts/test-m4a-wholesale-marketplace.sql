\set ON_ERROR_STOP on

-- M4A BSM wholesale marketplace regression.
-- Runs against a disposable fresh Supabase database and rolls back.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'b1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'm4a-seller@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b2000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'm4a-business-buyer@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b3000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'm4a-retail-buyer@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b4000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'm4a-other-business@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles_buyer(id, display_name)
values
  ('b1000000-0000-0000-0000-000000000001', 'M4A Supplier'),
  ('b2000000-0000-0000-0000-000000000002', 'M4A Business Buyer'),
  ('b3000000-0000-0000-0000-000000000003', 'M4A Retail Buyer'),
  ('b4000000-0000-0000-0000-000000000004', 'M4A Other Business');

insert into public.profiles_seller(
  id, storefront_name, business_type, verification_status,
  return_policy, shipping_policy
)
values
  ('b1000000-0000-0000-0000-000000000001', 'M4A Supplier Store', 'business', 'verified', 'Test returns.', 'Test shipping.'),
  ('b4000000-0000-0000-0000-000000000004', 'M4A Other Store', 'business', 'verified', 'Test returns.', 'Test shipping.');

insert into public.profiles_business(id, display_name, business_kind, country, verification_status)
values
  ('b1000000-0000-0000-0000-000000000001', 'M4A Supplier Ltd', 'supplier', 'PH', 'verified'),
  ('b2000000-0000-0000-0000-000000000002', 'M4A Buyer Co', 'retailer', 'PH', 'verified'),
  ('b4000000-0000-0000-0000-000000000004', 'M4A Other Co', 'distributor', 'PH', 'verified');

insert into public.products(
  id, seller_id, title, slug, description, type, status,
  moderation_status, base_price, requires_shipping, is_taxable,
  marketplace_brand
)
values (
  'b5000000-0000-0000-0000-000000000005',
  'b1000000-0000-0000-0000-000000000001',
  'M4A Wholesale Product', 'm4a-wholesale-product', 'M4A wholesale regression product',
  'physical', 'draft', 'not_submitted', 30.00, false, false, 'entiznetstore'
);

insert into public.product_variants(
  id, product_id, title, sku, price, track_inventory,
  inventory_quantity, inventory_policy, requires_shipping, is_active, position
)
values (
  'b6000000-0000-0000-0000-000000000006',
  'b5000000-0000-0000-0000-000000000005',
  'Case Unit', 'M4A-CASE', 30.00, true, 1000, 'deny', false, true, 0
);

insert into public.product_categories(product_id, category_id)
values (
  'b5000000-0000-0000-0000-000000000005',
  'b9ec6994-3765-4a06-a072-6bcf6b619645'
);

-- Preserve the canonical publication invariant: an active product must have
-- at least one product image. This fixture intentionally looks like a valid
-- publishable catalogue product rather than bypassing the M2 guard.
insert into public.product_media(product_id, variant_id, type, url, alt_text, position)
values (
  'b5000000-0000-0000-0000-000000000005',
  'b6000000-0000-0000-0000-000000000006',
  'image',
  'https://example.invalid/m4a-wholesale-product.jpg',
  'M4A wholesale regression product',
  0
);

update public.products
set moderation_status = 'approved', status = 'active', moderated_at = now(), updated_at = now()
where id = 'b5000000-0000-0000-0000-000000000005';

-- New browser RPCs are reviewed authenticated boundaries and stay closed to anon.
do $$
declare
  signatures regprocedure[] := array[
    'public.business_set_trading_roles(text[])'::regprocedure,
    'public.business_save_wholesale_offer(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamp with time zone,timestamp with time zone,jsonb)'::regprocedure,
    'public.buyer_set_wholesale_cart_item(uuid,integer)'::regprocedure
  ];
  fn regprocedure;
begin
  foreach fn in array signatures loop
    if has_function_privilege('anon', fn, 'EXECUTE') then
      raise exception 'anon unexpectedly executes M4A RPC %', fn;
    end if;
    if not has_function_privilege('authenticated', fn, 'EXECUTE') then
      raise exception 'authenticated missing reviewed M4A RPC %', fn;
    end if;
  end loop;
end
$$;

-- Supplier selects multiple additive trading roles. The first role remains the
-- compatibility projection in profiles_business.business_kind.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select public.business_set_trading_roles(array['manufacturer','distributor','wholesaler']) as roles \gset

do $$
begin
  if (select count(*) from public.business_trading_roles where business_id = 'b1000000-0000-0000-0000-000000000001') <> 3 then
    raise exception 'additive BSM trading roles were not persisted';
  end if;
  if (select role from public.business_trading_roles where business_id = 'b1000000-0000-0000-0000-000000000001' and is_primary) <> 'manufacturer' then
    raise exception 'primary BSM trading role not preserved';
  end if;
  if (select business_kind from public.profiles_business where id = 'b1000000-0000-0000-0000-000000000001') <> 'manufacturer' then
    raise exception 'legacy business_kind compatibility projection not updated';
  end if;
end
$$;

-- Direct table mutation remains forbidden to browser roles.
do $$
begin
  begin
    insert into public.wholesale_offers(
      seller_id, product_id, variant_id, minimum_order_quantity, order_multiple
    ) values (
      'b1000000-0000-0000-0000-000000000001',
      'b5000000-0000-0000-0000-000000000005',
      'b6000000-0000-0000-0000-000000000006', 10, 5
    );
    raise exception 'authenticated Seller bypassed wholesale offer RPC';
  exception when insufficient_privilege then null;
  end;
end
$$;

select public.business_save_wholesale_offer(
  null,
  'b5000000-0000-0000-0000-000000000005',
  'b6000000-0000-0000-0000-000000000006',
  'active',
  10,
  5,
  'unit',
  10,
  7,
  'FOB',
  null,
  null,
  '[
    {"minimumQuantity":10,"unitPriceCents":2000},
    {"minimumQuantity":50,"unitPriceCents":1800},
    {"minimumQuantity":100,"unitPriceCents":1600}
  ]'::jsonb
) as offer_id \gset
select set_config('m4a.offer_id', :'offer_id', false);

reset role;

do $$
begin
  if (select status from public.wholesale_offers where id = current_setting('m4a.offer_id')::uuid) <> 'active' then
    raise exception 'wholesale offer did not activate';
  end if;
  if (select count(*) from public.wholesale_offer_tiers where offer_id = current_setting('m4a.offer_id')::uuid) <> 3 then
    raise exception 'wholesale pricing tiers not persisted';
  end if;
end
$$;

-- Another BSM cannot edit the Supplier's offer because the RPC is auth.uid-scoped.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"b4000000-0000-0000-0000-000000000004","role":"authenticated"}', true);

do $$
begin
  begin
    perform public.business_save_wholesale_offer(
      current_setting('m4a.offer_id')::uuid,
      'b5000000-0000-0000-0000-000000000005',
      'b6000000-0000-0000-0000-000000000006',
      'paused', 10, 5, 'unit', 10, 7, 'FOB', null, null,
      '[{"minimumQuantity":10,"unitPriceCents":1}]'::jsonb
    );
    raise exception 'cross-BSM offer edit unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- Ordinary Buyers cannot see B2B prices or place wholesale items.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b3000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-0000-0000-000000000003","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.wholesale_offers where id = current_setting('m4a.offer_id')::uuid) <> 0 then
    raise exception 'wholesale offer leaked to ordinary Buyer';
  end if;
  if (select count(*) from public.wholesale_offer_tiers where offer_id = current_setting('m4a.offer_id')::uuid) <> 0 then
    raise exception 'wholesale pricing tier leaked to ordinary Buyer';
  end if;
  begin
    perform public.buyer_set_wholesale_cart_item(current_setting('m4a.offer_id')::uuid, 50);
    raise exception 'ordinary Buyer unexpectedly placed wholesale cart item';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- Verified Business buyer can see the offer, but MOQ/order-multiple rules are
-- authoritative at the database boundary.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"b2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.wholesale_offers where id = current_setting('m4a.offer_id')::uuid) <> 1 then
    raise exception 'verified Business buyer cannot see active wholesale offer';
  end if;
  if (select count(*) from public.wholesale_offer_tiers where offer_id = current_setting('m4a.offer_id')::uuid) <> 3 then
    raise exception 'verified Business buyer cannot see pricing tiers';
  end if;

  begin
    perform public.buyer_set_wholesale_cart_item(current_setting('m4a.offer_id')::uuid, 5);
    raise exception 'below-MOQ wholesale quantity unexpectedly succeeded';
  exception when sqlstate '22023' then null;
  end;

  begin
    perform public.buyer_set_wholesale_cart_item(current_setting('m4a.offer_id')::uuid, 12);
    raise exception 'invalid wholesale order multiple unexpectedly succeeded';
  exception when sqlstate '22023' then null;
  end;
end
$$;

select public.buyer_set_wholesale_cart_item(current_setting('m4a.offer_id')::uuid, 50) as wholesale_item_id \gset
select set_config('m4a.wholesale_item_id', :'wholesale_item_id', false);
select public.buyer_set_cart_item(
  'b5000000-0000-0000-0000-000000000005',
  'b6000000-0000-0000-0000-000000000006',
  2
) as retail_item_id \gset
select set_config('m4a.retail_item_id', :'retail_item_id', false);

do $$
begin
  if (
    select count(*) from public.cart_items ci
    join public.carts c on c.id = ci.cart_id
    where c.buyer_id = 'b2000000-0000-0000-0000-000000000002'
      and ci.variant_id = 'b6000000-0000-0000-0000-000000000006'
  ) <> 2 then
    raise exception 'retail and wholesale modes cannot coexist for same variant';
  end if;

  begin
    perform public.buyer_set_cart_item(
      'b5000000-0000-0000-0000-000000000005',
      'b6000000-0000-0000-0000-000000000006',
      101
    );
    raise exception 'retail quantity ceiling was weakened by wholesale support';
  exception when sqlstate '22023' then null;
  end;
end
$$;

-- Remove retail fixture so the checkout proof isolates one wholesale line.
select public.buyer_remove_cart_item(current_setting('m4a.retail_item_id')::uuid);
select public.buyer_get_or_create_cart() as cart_id \gset
select set_config('m4a.cart_id', :'cart_id', false);
reset role;

select version as cart_version from public.carts where id = :'cart_id'::uuid \gset
select set_config('m4a.cart_version', :'cart_version', false);

-- Trusted server quote at the current 50+ tier (1,800 cents).
insert into public.cart_quotes(
  id, cart_id, buyer_id, cart_version, status, block_reasons, currency,
  subtotal_cents, tax_cents, shipping_cents, discount_cents, total_cents,
  shipping_address, shipping_quote, tax_quote, items_snapshot, seller_totals,
  expires_at
)
values (
  'b7000000-0000-0000-0000-000000000007',
  :'cart_id'::uuid,
  'b2000000-0000-0000-0000-000000000002',
  :'cart_version'::bigint,
  'ready', '{}'::text[], 'usd', 90000, 0, 0, 0, 90000,
  null,
  '{"provider":"internal","status":"not_required","amountCents":0}'::jsonb,
  '{"provider":"internal","status":"not_required","amountCents":0}'::jsonb,
  jsonb_build_array(jsonb_build_object(
    'cartItemId', :'wholesale_item_id'::uuid,
    'productId', 'b5000000-0000-0000-0000-000000000005',
    'variantId', 'b6000000-0000-0000-0000-000000000006',
    'sellerId', 'b1000000-0000-0000-0000-000000000001',
    'title', 'M4A Wholesale Product',
    'variantTitle', 'Case Unit',
    'sku', 'M4A-CASE',
    'quantity', 50,
    'purchaseMode', 'wholesale',
    'wholesaleOfferId', current_setting('m4a.offer_id')::uuid,
    'unitPriceCents', 1800,
    'lineTotalCents', 90000,
    'requiresShipping', false,
    'isTaxable', false,
    'available', true
  )),
  jsonb_build_object(
    'b1000000-0000-0000-0000-000000000001',
    jsonb_build_object(
      'subtotalCents', 90000,
      'taxCents', 0,
      'shippingCents', 0,
      'discountCents', 0,
      'totalCents', 90000
    )
  ),
  now() + interval '15 minutes'
);

-- Seller changes the live 50+ tier after quote creation. Checkout must reject
-- stale wholesale pricing instead of honoring the old quote price.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select public.business_save_wholesale_offer(
  current_setting('m4a.offer_id')::uuid,
  'b5000000-0000-0000-0000-000000000005',
  'b6000000-0000-0000-0000-000000000006',
  'active', 10, 5, 'unit', 10, 7, 'FOB', null, null,
  '[
    {"minimumQuantity":10,"unitPriceCents":2000},
    {"minimumQuantity":50,"unitPriceCents":1700},
    {"minimumQuantity":100,"unitPriceCents":1500}
  ]'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"b2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

do $$
begin
  begin
    perform * from public.create_checkout_session_v2(
      current_setting('m4a.cart_id')::uuid,
      'b7000000-0000-0000-0000-000000000007',
      'b8000000-0000-0000-0000-000000000008'
    );
    raise exception 'stale wholesale quote unexpectedly reached checkout';
  exception when sqlstate '22023' then null;
  end;
end
$$;

-- A Business capability suspension after quote creation must also fail closed.
reset role;
insert into public.marketplace_capability_states(
  user_id, capability, status, reason, suspended_at, suspended_by
)
values (
  'b2000000-0000-0000-0000-000000000002',
  'business',
  'suspended',
  'M4A regression',
  now(),
  'b4000000-0000-0000-0000-000000000004'
)
on conflict (user_id, capability)
do update set
  status = excluded.status,
  reason = excluded.reason,
  suspended_at = excluded.suspended_at,
  suspended_by = excluded.suspended_by,
  updated_at = now();

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"b2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

do $$
begin
  begin
    perform * from public.create_checkout_session_v2(
      current_setting('m4a.cart_id')::uuid,
      'b7000000-0000-0000-0000-000000000007',
      'b9000000-0000-0000-0000-000000000009'
    );
    raise exception 'suspended Business unexpectedly reached wholesale checkout';
  exception when insufficient_privilege then null;
  end;
end
$$;

reset role;
update public.marketplace_capability_states
set status = 'active',
    reason = null,
    suspended_at = null,
    suspended_by = null,
    restored_at = now(),
    restored_by = 'b4000000-0000-0000-0000-000000000004',
    updated_at = now()
where user_id = 'b2000000-0000-0000-0000-000000000002' and capability = 'business';

-- Fresh trusted quote at the new 50+ tier (1,700 cents).
insert into public.cart_quotes(
  id, cart_id, buyer_id, cart_version, status, block_reasons, currency,
  subtotal_cents, tax_cents, shipping_cents, discount_cents, total_cents,
  shipping_address, shipping_quote, tax_quote, items_snapshot, seller_totals,
  expires_at
)
values (
  'ba000000-0000-0000-0000-00000000000a',
  :'cart_id'::uuid,
  'b2000000-0000-0000-0000-000000000002',
  :'cart_version'::bigint,
  'ready', '{}'::text[], 'usd', 85000, 0, 0, 0, 85000,
  null,
  '{"provider":"internal","status":"not_required","amountCents":0}'::jsonb,
  '{"provider":"internal","status":"not_required","amountCents":0}'::jsonb,
  jsonb_build_array(jsonb_build_object(
    'cartItemId', :'wholesale_item_id'::uuid,
    'productId', 'b5000000-0000-0000-0000-000000000005',
    'variantId', 'b6000000-0000-0000-0000-000000000006',
    'sellerId', 'b1000000-0000-0000-0000-000000000001',
    'title', 'M4A Wholesale Product',
    'variantTitle', 'Case Unit',
    'sku', 'M4A-CASE',
    'quantity', 50,
    'purchaseMode', 'wholesale',
    'wholesaleOfferId', current_setting('m4a.offer_id')::uuid,
    'unitPriceCents', 1700,
    'lineTotalCents', 85000,
    'requiresShipping', false,
    'isTaxable', false,
    'available', true
  )),
  jsonb_build_object(
    'b1000000-0000-0000-0000-000000000001',
    jsonb_build_object(
      'subtotalCents', 85000,
      'taxCents', 0,
      'shippingCents', 0,
      'discountCents', 0,
      'totalCents', 85000
    )
  ),
  now() + interval '15 minutes'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"b2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select * from public.create_checkout_session_v2(
  :'cart_id'::uuid,
  'ba000000-0000-0000-0000-00000000000a',
  'bb000000-0000-0000-0000-00000000000b'
) \gset
select set_config('m4a.session_id', :'session_id', false);
select set_config('m4a.amount_cents', :'amount_cents', false);

reset role;

do $$
declare
  v_item public.order_items%rowtype;
  v_reservation integer;
begin
  if current_setting('m4a.amount_cents')::bigint <> 85000 then
    raise exception 'wholesale checkout amount was not server-authoritative';
  end if;

  select oi.* into v_item
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.payment_session_id = current_setting('m4a.session_id')::uuid
  limit 1;

  if v_item.purchase_mode <> 'wholesale'
     or v_item.wholesale_offer_id <> current_setting('m4a.offer_id')::uuid
     or v_item.price_cents <> 1700
     or v_item.quantity <> 50
     or (v_item.pricing_snapshot->>'tierMinimumQuantity')::integer <> 50
     or (v_item.pricing_snapshot->>'unitPriceCents')::bigint <> 1700 then
    raise exception 'wholesale order pricing snapshot lost authority metadata';
  end if;

  select quantity into v_reservation
  from public.inventory_reservations
  where payment_session_id = current_setting('m4a.session_id')::uuid
    and variant_id = 'b6000000-0000-0000-0000-000000000006'
    and status = 'pending';

  if v_reservation <> 50 then
    raise exception 'wholesale checkout did not reserve canonical inventory';
  end if;
end
$$;

rollback;

select 'M4A wholesale marketplace regression passed' as result;