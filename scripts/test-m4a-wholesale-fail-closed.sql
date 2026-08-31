\set ON_ERROR_STOP on

-- M4A fail-closed wholesale boundaries.
-- This suite targets state transitions that must instantly remove B2B price
-- visibility and block wholesale cart mutation. It runs on a disposable fresh
-- Supabase database and rolls back completely.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'c1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'm4a-negative-supplier@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'm4a-negative-buyer@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'c4000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'm4a-negative-actor@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles_buyer(id, display_name)
values
  ('c1000000-0000-0000-0000-000000000001', 'M4A Negative Supplier'),
  ('c2000000-0000-0000-0000-000000000002', 'M4A Negative Business Buyer'),
  ('c4000000-0000-0000-0000-000000000004', 'M4A Negative Actor');

insert into public.profiles_seller(
  id, storefront_name, business_type, verification_status,
  return_policy, shipping_policy
)
values (
  'c1000000-0000-0000-0000-000000000001',
  'M4A Negative Supplier Store',
  'business',
  'verified',
  'Negative regression returns.',
  'Negative regression shipping.'
);

insert into public.profiles_business(id, display_name, business_kind, country, verification_status)
values
  ('c1000000-0000-0000-0000-000000000001', 'M4A Negative Supplier Ltd', 'supplier', 'PH', 'verified'),
  ('c2000000-0000-0000-0000-000000000002', 'M4A Negative Buyer Ltd', 'retailer', 'PH', 'verified');

insert into public.products(
  id, seller_id, title, slug, description, type, status,
  moderation_status, base_price, requires_shipping, is_taxable,
  marketplace_brand
)
values (
  'c5000000-0000-0000-0000-000000000005',
  'c1000000-0000-0000-0000-000000000001',
  'M4A Negative Wholesale Product',
  'm4a-negative-wholesale-product',
  'M4A fail-closed wholesale regression product',
  'physical', 'draft', 'not_submitted', 30.00, false, false, 'entiznetstore'
);

insert into public.product_variants(
  id, product_id, title, sku, price, track_inventory,
  inventory_quantity, inventory_policy, requires_shipping, is_active, position
)
values (
  'c6000000-0000-0000-0000-000000000006',
  'c5000000-0000-0000-0000-000000000005',
  'Case Unit', 'M4A-NEGATIVE-CASE', 30.00, true, 1000, 'deny', false, true, 0
);

insert into public.product_categories(product_id, category_id)
values (
  'c5000000-0000-0000-0000-000000000005',
  'b9ec6994-3765-4a06-a072-6bcf6b619645'
);

insert into public.product_media(product_id, variant_id, type, url, alt_text, position)
values (
  'c5000000-0000-0000-0000-000000000005',
  'c6000000-0000-0000-0000-000000000006',
  'image',
  'https://example.invalid/m4a-negative-wholesale.jpg',
  'M4A negative wholesale regression product',
  0
);

update public.products
set moderation_status = 'approved', status = 'active', moderated_at = now(), updated_at = now()
where id = 'c5000000-0000-0000-0000-000000000005';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select public.business_save_wholesale_offer(
  null,
  'c5000000-0000-0000-0000-000000000005',
  'c6000000-0000-0000-0000-000000000006',
  'active', 10, 5, 'unit', 10, 3, 'FOB', null, null,
  '[
    {"minimumQuantity":10,"unitPriceCents":2000},
    {"minimumQuantity":50,"unitPriceCents":1800},
    {"minimumQuantity":100,"unitPriceCents":1600}
  ]'::jsonb
) as offer_id \gset
select set_config('m4a_negative.offer_id', :'offer_id', false);

-- Invalid edits are statement-atomic. A tier that becomes more expensive as
-- volume rises must fail without leaving the offer in draft or deleting its
-- previously valid pricing tiers.
do $$
begin
  begin
    perform public.business_save_wholesale_offer(
      current_setting('m4a_negative.offer_id')::uuid,
      'c5000000-0000-0000-0000-000000000005',
      'c6000000-0000-0000-0000-000000000006',
      'active', 10, 5, 'unit', 10, 3, 'FOB', null, null,
      '[
        {"minimumQuantity":10,"unitPriceCents":2000},
        {"minimumQuantity":50,"unitPriceCents":2100}
      ]'::jsonb
    );
    raise exception 'increasing wholesale tier price unexpectedly succeeded';
  exception when sqlstate '22023' then null;
  end;
end
$$;

reset role;
do $$
begin
  if (select status from public.wholesale_offers where id = current_setting('m4a_negative.offer_id')::uuid) <> 'active' then
    raise exception 'failed offer edit changed previously active status';
  end if;
  if (select count(*) from public.wholesale_offer_tiers where offer_id = current_setting('m4a_negative.offer_id')::uuid) <> 3 then
    raise exception 'failed offer edit destroyed valid pricing tiers';
  end if;
  if (select unit_price_cents from public.wholesale_offer_tiers where offer_id = current_setting('m4a_negative.offer_id')::uuid and minimum_quantity = 50) <> 1800 then
    raise exception 'failed offer edit partially persisted invalid tier price';
  end if;
end
$$;

-- MOQ and order multiple are relative, not divisibility-coupled. MOQ 12 with a
-- multiple of 5 means 12, 17, 22, 27, ... are valid quantities. Prove the
-- database and cart authority accept that model and reject off-sequence values.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select public.business_save_wholesale_offer(
  current_setting('m4a_negative.offer_id')::uuid,
  'c5000000-0000-0000-0000-000000000005',
  'c6000000-0000-0000-0000-000000000006',
  'active', 12, 5, 'unit', 10, 3, 'FOB', null, null,
  '[
    {"minimumQuantity":12,"unitPriceCents":2000},
    {"minimumQuantity":17,"unitPriceCents":1900},
    {"minimumQuantity":22,"unitPriceCents":1800}
  ]'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"c2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select public.buyer_set_wholesale_cart_item(current_setting('m4a_negative.offer_id')::uuid, 12);
select public.buyer_set_wholesale_cart_item(current_setting('m4a_negative.offer_id')::uuid, 17);
do $$
begin
  begin
    perform public.buyer_set_wholesale_cart_item(current_setting('m4a_negative.offer_id')::uuid, 15);
    raise exception 'off-sequence MOQ-relative quantity unexpectedly succeeded';
  exception when sqlstate '22023' then null;
  end;
end
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select public.business_save_wholesale_offer(
  current_setting('m4a_negative.offer_id')::uuid,
  'c5000000-0000-0000-0000-000000000005',
  'c6000000-0000-0000-0000-000000000006',
  'active', 10, 5, 'unit', 10, 3, 'FOB', null, null,
  '[
    {"minimumQuantity":10,"unitPriceCents":2000},
    {"minimumQuantity":50,"unitPriceCents":1800},
    {"minimumQuantity":100,"unitPriceCents":1600}
  ]'::jsonb
);
reset role;

-- A future-dated active offer is operationally unavailable: the verified
-- Business buyer cannot see its price or create/update a wholesale line.
update public.wholesale_offers
set starts_at = now() + interval '1 hour',
    ends_at = now() + interval '2 hours'
where id = current_setting('m4a_negative.offer_id')::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"c2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.wholesale_offers where id = current_setting('m4a_negative.offer_id')::uuid) <> 0 then
    raise exception 'future-dated wholesale offer leaked to Business buyer';
  end if;
  if (select count(*) from public.wholesale_offer_tiers where offer_id = current_setting('m4a_negative.offer_id')::uuid) <> 0 then
    raise exception 'future-dated wholesale tier price leaked to Business buyer';
  end if;
  begin
    perform public.buyer_set_wholesale_cart_item(current_setting('m4a_negative.offer_id')::uuid, 50);
    raise exception 'future-dated wholesale offer accepted cart mutation';
  exception when sqlstate '22023' then null;
  end;
end
$$;

reset role;
update public.wholesale_offers
set starts_at = null, ends_at = null
where id = current_setting('m4a_negative.offer_id')::uuid;

-- Establish a valid line, then prove supplier capability suspension immediately
-- removes B2B visibility and blocks further wholesale cart mutation.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"c2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select public.buyer_set_wholesale_cart_item(current_setting('m4a_negative.offer_id')::uuid, 50);

reset role;
insert into public.marketplace_capability_states(
  user_id, capability, status, reason, suspended_at, suspended_by
)
values (
  'c1000000-0000-0000-0000-000000000001',
  'seller',
  'suspended',
  'M4A negative Seller suspension',
  now(),
  'c4000000-0000-0000-0000-000000000004'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"c2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.wholesale_offers where id = current_setting('m4a_negative.offer_id')::uuid) <> 0 then
    raise exception 'Seller-suspended supplier wholesale offer remained visible';
  end if;
  begin
    perform public.buyer_set_wholesale_cart_item(current_setting('m4a_negative.offer_id')::uuid, 50);
    raise exception 'Seller-suspended supplier accepted wholesale cart mutation';
  exception when sqlstate '22023' then null;
  end;
end
$$;

reset role;
update public.marketplace_capability_states
set status = 'active', reason = null, suspended_at = null, suspended_by = null,
    restored_at = now(), restored_by = 'c4000000-0000-0000-0000-000000000004', updated_at = now()
where user_id = 'c1000000-0000-0000-0000-000000000001' and capability = 'seller';

insert into public.marketplace_capability_states(
  user_id, capability, status, reason, suspended_at, suspended_by
)
values (
  'c1000000-0000-0000-0000-000000000001',
  'business',
  'suspended',
  'M4A negative Business suspension',
  now(),
  'c4000000-0000-0000-0000-000000000004'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"c2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.wholesale_offers where id = current_setting('m4a_negative.offer_id')::uuid) <> 0 then
    raise exception 'Business-suspended supplier wholesale offer remained visible';
  end if;
  begin
    perform public.buyer_set_wholesale_cart_item(current_setting('m4a_negative.offer_id')::uuid, 50);
    raise exception 'Business-suspended supplier accepted wholesale cart mutation';
  exception when sqlstate '22023' then null;
  end;
end
$$;

reset role;
update public.marketplace_capability_states
set status = 'active', reason = null, suspended_at = null, suspended_by = null,
    restored_at = now(), restored_by = 'c4000000-0000-0000-0000-000000000004', updated_at = now()
where user_id = 'c1000000-0000-0000-0000-000000000001' and capability = 'business';

-- Verification loss on the purchasing Business must also hide all offer/tier
-- pricing and deny cart mutation, even though its Buyer profile still exists.
update public.profiles_business
set verification_status = 'pending', updated_at = now()
where id = 'c2000000-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"c2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.wholesale_offers where id = current_setting('m4a_negative.offer_id')::uuid) <> 0 then
    raise exception 'unverified Business buyer retained wholesale offer visibility';
  end if;
  if (select count(*) from public.wholesale_offer_tiers where offer_id = current_setting('m4a_negative.offer_id')::uuid) <> 0 then
    raise exception 'unverified Business buyer retained wholesale tier pricing';
  end if;
  begin
    perform public.buyer_set_wholesale_cart_item(current_setting('m4a_negative.offer_id')::uuid, 50);
    raise exception 'unverified Business buyer accepted wholesale cart mutation';
  exception when insufficient_privilege then null;
  end;
end
$$;

rollback;

select 'M4A wholesale fail-closed regression passed' as result;