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

insert into public.profiles_seller(id, storefront_name, verification_status)
values ('9a000000-0000-0000-0000-00000000000a', 'M2 Active Invariant Store', 'verified');

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

-- Approved active state remains valid.
insert into public.products(
  seller_id, title, slug, status, moderation_status, base_price
) values (
  '9a000000-0000-0000-0000-00000000000a',
  'Approved Active Product',
  'approved-active-product',
  'active',
  'approved',
  10
);

rollback;

select 'M2 active product approval invariant regression passed' as result;
