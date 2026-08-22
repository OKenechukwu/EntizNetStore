\set ON_ERROR_STOP on

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '9a000000-0000-0000-0000-00000000000a',
  'authenticated', 'authenticated', 'm2-active-invariant@test.invalid', '',
  now(), '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.profiles_seller(
  id, storefront_name, verification_status, shipping_policy, return_policy
) values (
  '9a000000-0000-0000-0000-00000000000a',
  'M2 Active Invariant Store',
  'verified',
  'Tracked shipping with delivery expectations.',
  'Returns accepted under the Seller policy.'
);

-- Even a trusted direct write cannot create an active product that has not
-- passed product moderation.
do $$
begin
  begin
    insert into public.products(
      seller_id, title, slug, status, moderation_status, base_price
    ) values (
      '9a000000-0000-0000-0000-00000000000a',
      'Unapproved Active Product',
      'unapproved-active-product',
      'active',
      'not_submitted',
      10
    );
    raise exception 'Expected active unapproved product invariant to reject write';
  exception
    when check_violation then null;
  end;
end
$$;

-- A complete draft can transition atomically to approved + active. This proves
-- the invariant permits the canonical post-review terminal state rather than
-- merely blocking every active product.
insert into public.products(
  id, seller_id, title, slug, status, moderation_status, base_price
) values (
  '9b000000-0000-0000-0000-00000000000b',
  '9a000000-0000-0000-0000-00000000000a',
  'Approved Active Product',
  'approved-active-product',
  'draft',
  'not_submitted',
  10
);

insert into public.product_categories(product_id, category_id)
values (
  '9b000000-0000-0000-0000-00000000000b',
  'b9ec6994-3765-4a06-a072-6bcf6b619645'
);

insert into public.product_media(product_id, type, url, position)
values (
  '9b000000-0000-0000-0000-00000000000b',
  'image',
  'https://example.invalid/approved.webp',
  0
);

insert into public.product_variants(
  product_id, title, price, inventory_quantity, track_inventory,
  inventory_policy, is_active, position
) values (
  '9b000000-0000-0000-0000-00000000000b',
  'Default', 10, 1, true, 'deny', true, 0
);

update public.products
set moderation_status = 'approved', status = 'active'
where id = '9b000000-0000-0000-0000-00000000000b';

do $$
declare
  v_status text;
  v_moderation text;
begin
  select status, moderation_status
    into v_status, v_moderation
  from public.products
  where id = '9b000000-0000-0000-0000-00000000000b';

  if v_status <> 'active' or v_moderation <> 'approved' then
    raise exception 'Canonical approved active state was not preserved';
  end if;
end
$$;

rollback;

select 'M2 active product approval invariant regression passed' as result;
