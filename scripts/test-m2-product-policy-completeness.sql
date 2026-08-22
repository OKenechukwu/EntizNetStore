\set ON_ERROR_STOP on

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '9c000000-0000-0000-0000-00000000000c',
  'authenticated', 'authenticated', 'm2-policy-guard@test.invalid', '',
  now(), '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.profiles_seller(id, storefront_name, verification_status)
values ('9c000000-0000-0000-0000-00000000000c', 'M2 Policy Guard Store', 'verified');

insert into public.products(
  id, seller_id, title, slug, status, moderation_status, base_price, requires_shipping
) values (
  '9d000000-0000-0000-0000-00000000000d',
  '9c000000-0000-0000-0000-00000000000c',
  'M2 Policy Guard Product',
  'm2-policy-guard-product',
  'draft',
  'not_submitted',
  25,
  true
);

insert into public.product_categories(product_id, category_id)
values (
  '9d000000-0000-0000-0000-00000000000d',
  'b9ec6994-3765-4a06-a072-6bcf6b619645'
);

insert into public.product_media(product_id, type, url, position)
values (
  '9d000000-0000-0000-0000-00000000000d',
  'image',
  'https://example.invalid/policy-guard.webp',
  0
);

insert into public.product_variants(
  product_id, title, price, inventory_quantity, track_inventory,
  inventory_policy, is_active, position
) values (
  '9d000000-0000-0000-0000-00000000000d',
  'Default', 25, 5, true, 'deny', true, 0
);

-- A verified Seller still cannot submit a product with no actual return terms.
do $$
begin
  begin
    update public.products
    set moderation_status = 'pending'
    where id = '9d000000-0000-0000-0000-00000000000d';
    raise exception 'Expected missing Seller return policy to block review';
  exception
    when check_violation then
      if sqlerrm <> 'seller_return_policy_required' then raise; end if;
  end;
end
$$;

update public.profiles_seller
set return_policy = 'Returns accepted under the Seller return policy.'
where id = '9c000000-0000-0000-0000-00000000000c';

-- Physical/shippable products also require real shipping terms.
do $$
begin
  begin
    update public.products
    set moderation_status = 'pending'
    where id = '9d000000-0000-0000-0000-00000000000d';
    raise exception 'Expected missing Seller shipping policy to block review';
  exception
    when check_violation then
      if sqlerrm <> 'seller_shipping_policy_required' then raise; end if;
  end;
end
$$;

update public.profiles_seller
set shipping_policy = 'Tracked shipping with delivery expectations.'
where id = '9c000000-0000-0000-0000-00000000000c';

update public.products
set moderation_status = 'pending'
where id = '9d000000-0000-0000-0000-00000000000d';

do $$
declare v_status text;
begin
  select moderation_status into v_status
  from public.products
  where id = '9d000000-0000-0000-0000-00000000000d';
  if v_status <> 'pending' then
    raise exception 'Complete Seller policies did not permit product review';
  end if;
end
$$;

rollback;

select 'M2 Seller policy completeness regression passed' as result;
