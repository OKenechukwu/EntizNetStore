\set ON_ERROR_STOP on

-- M2 Seller inventory edits must never invalidate active checkout reservations.
-- Disposable fresh-database regression; all fixtures roll back.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '94000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'm2-inventory-seller@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '95000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'm2-inventory-buyer@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles_seller(id, storefront_name, verification_status)
values ('94000000-0000-0000-0000-000000000004', 'M2 Inventory Store', 'verified');

insert into public.profiles_buyer(id, display_name)
values ('95000000-0000-0000-0000-000000000005', 'M2 Inventory Buyer');

insert into public.products(
  id, seller_id, title, slug, description, status, moderation_status,
  base_price, marketplace_brand
) values (
  '96000000-0000-0000-0000-000000000006',
  '94000000-0000-0000-0000-000000000004',
  'Reserved Inventory Product', 'reserved-inventory-product', 'M2 inventory guard fixture',
  'draft', 'not_submitted', 50, 'entiznetstore'
);

insert into public.product_variants(
  id, product_id, title, sku, price, inventory_quantity,
  track_inventory, inventory_policy, is_active, position
) values (
  '97000000-0000-0000-0000-000000000007',
  '96000000-0000-0000-0000-000000000006',
  'Default', 'M2-RESERVED', 50, 10, true, 'deny', true, 0
);

insert into public.payment_sessions(
  id, buyer_id, idempotency_key, status, currency, amount_cents
) values (
  '98000000-0000-0000-0000-000000000008',
  '95000000-0000-0000-0000-000000000005',
  '99000000-0000-0000-0000-000000000009',
  'pending', 'usd', 25000
);

insert into public.inventory_reservations(
  payment_session_id, product_id, variant_id, quantity, status, expires_at
) values (
  '98000000-0000-0000-0000-000000000008',
  '96000000-0000-0000-0000-000000000006',
  '97000000-0000-0000-0000-000000000007',
  5, 'pending', now() + interval '20 minutes'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000004', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"94000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

-- Reducing tracked stock below five pending reserved units must fail.
do $$
begin
  begin
    perform public.seller_save_product_v3(
      '96000000-0000-0000-0000-000000000006',
      'Reserved Inventory Product',
      'M2 inventory guard fixture',
      '',
      'physical',
      50,
      null,
      null,
      null,
      array['b9ec6994-3765-4a06-a072-6bcf6b619645']::uuid[],
      '{}'::text[],
      '[{"id":"97000000-0000-0000-0000-000000000007","title":"Default","sku":"M2-RESERVED","price":50,"trackInventory":true,"inventoryQuantity":4,"inventoryPolicy":"deny","requiresShipping":true,"isActive":true}]'::jsonb,
      true, false, true, true, null, null, 18, '{}'::text[], '{}'::text[]
    );
    raise exception 'Expected inventory edit below active reservations to fail';
  exception
    when check_violation then
      if sqlerrm not like 'inventory_below_pending_reservations:%' then raise; end if;
  end;
end
$$;

-- The failed attempt must leave stock unchanged.
do $$
declare v_inventory integer;
begin
  select inventory_quantity into v_inventory
  from public.product_variants
  where id = '97000000-0000-0000-0000-000000000007';
  if v_inventory <> 10 then
    raise exception 'Failed Seller inventory edit partially changed stock: %', v_inventory;
  end if;
end
$$;

-- Reducing stock exactly to the already-reserved quantity is safe.
select public.seller_save_product_v3(
  '96000000-0000-0000-0000-000000000006',
  'Reserved Inventory Product',
  'M2 inventory guard fixture',
  '',
  'physical',
  50,
  null,
  null,
  null,
  array['b9ec6994-3765-4a06-a072-6bcf6b619645']::uuid[],
  '{}'::text[],
  '[{"id":"97000000-0000-0000-0000-000000000007","title":"Default","sku":"M2-RESERVED","price":50,"trackInventory":true,"inventoryQuantity":5,"inventoryPolicy":"deny","requiresShipping":true,"isActive":true}]'::jsonb,
  true, false, true, true, null, null, 18, '{}'::text[], '{}'::text[]
);

reset role;

do $$
declare
  v_inventory integer;
  v_reserved integer;
begin
  select inventory_quantity into v_inventory
  from public.product_variants
  where id = '97000000-0000-0000-0000-000000000007';

  select coalesce(sum(quantity), 0)::integer into v_reserved
  from public.inventory_reservations
  where variant_id = '97000000-0000-0000-0000-000000000007'
    and status = 'pending'
    and expires_at > now();

  if v_inventory <> 5 or v_reserved <> 5 then
    raise exception 'Safe Seller inventory edit/reservation state mismatch: inventory %, reserved %',
      v_inventory, v_reserved;
  end if;
end
$$;

rollback;

select 'M2 inventory reservation guard regression passed' as result;
