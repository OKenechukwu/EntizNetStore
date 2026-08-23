\set ON_ERROR_STOP on

-- Combined M3 identity, capability-specific suspension, and EntizNet-link
-- regression suite. Runs only against the disposable fresh CI database.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'b1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'm3-multi@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b2000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'm3-other@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b3000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'm3-admin@test.invalid', '', now(), '{"role":"admin"}'::jsonb, '{}'::jsonb, now(), now());

-- One human account owns all three additive Store capabilities.
insert into public.profiles_buyer(id, display_name)
values
  ('b1000000-0000-0000-0000-000000000001', 'M3 Multi Capability'),
  ('b2000000-0000-0000-0000-000000000002', 'M3 Other Account');

insert into public.profiles_seller(
  id, storefront_name, business_type, verification_status,
  return_policy, shipping_policy
)
values (
  'b1000000-0000-0000-0000-000000000001',
  'M3 Multi Store', 'business', 'verified',
  'Regression return policy', 'Regression shipping policy'
);

insert into public.profiles_business(
  id, display_name, legal_name, business_kind, verification_status
)
values (
  'b1000000-0000-0000-0000-000000000001',
  'M3 Multi Business', 'M3 Multi Business LLC', 'brand', 'verified'
);

insert into public.products(
  id, seller_id, title, slug, description, type, status,
  moderation_status, base_price, requires_shipping, is_taxable,
  marketplace_brand
)
values (
  'b4000000-0000-0000-0000-000000000004',
  'b1000000-0000-0000-0000-000000000001',
  'M3 Capability Product', 'm3-capability-product', 'Capability regression product',
  'digital', 'draft', 'not_submitted', 15.00, false, false, 'entiznetstore'
);

insert into public.product_variants(
  id, product_id, title, sku, price, track_inventory,
  inventory_quantity, inventory_policy, requires_shipping, is_active, position
)
values (
  'b5000000-0000-0000-0000-000000000005',
  'b4000000-0000-0000-0000-000000000004',
  'Default', 'M3-CAP', 15.00, true, 10, 'deny', false, true, 0
);

insert into public.product_categories(product_id, category_id)
values ('b4000000-0000-0000-0000-000000000004', 'b9ec6994-3765-4a06-a072-6bcf6b619645');

insert into public.product_media(product_id, type, url, position)
values ('b4000000-0000-0000-0000-000000000004', 'image', 'https://example.invalid/m3-capability.webp', 0);

update public.products
set moderation_status = 'approved', status = 'active', moderated_at = now(), updated_at = now()
where id = 'b4000000-0000-0000-0000-000000000004';

-- Trusted execution boundaries must be explicit.
do $$
begin
  if has_function_privilege('anon', 'public.admin_set_marketplace_capability_state(uuid,uuid,text,text,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.admin_set_marketplace_capability_state(uuid,uuid,text,text,text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.admin_set_marketplace_capability_state(uuid,uuid,text,text,text)', 'EXECUTE') then
    raise exception 'Admin capability-state RPC execution boundary is incorrect';
  end if;

  if has_function_privilege('anon', 'public.upsert_entiznet_identity_link(uuid,uuid,text[],text,text,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.upsert_entiznet_identity_link(uuid,uuid,text[],text,text,jsonb)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.upsert_entiznet_identity_link(uuid,uuid,text[],text,text,jsonb)', 'EXECUTE') then
    raise exception 'EntizNet identity-link RPC execution boundary is incorrect';
  end if;

  if has_function_privilege('authenticated', 'public.register_entiznet_handoff(text,uuid,text,text,text,text[],timestamp with time zone,timestamp with time zone,jsonb)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.register_entiznet_handoff(text,uuid,text,text,text,text[],timestamp with time zone,timestamp with time zone,jsonb)', 'EXECUTE') then
    raise exception 'EntizNet handoff registration execution boundary is incorrect';
  end if;
end
$$;

-- Approved product starts publicly visible.
set local role anon;
do $$
begin
  if (select count(*) from public.products where id = 'b4000000-0000-0000-0000-000000000004') <> 1 then
    raise exception 'Verified active Seller product is not public before suspension';
  end if;
end
$$;
reset role;

-- Suspend Seller only. Buyer and Business remain effective.
select public.admin_set_marketplace_capability_state(
  'b3000000-0000-0000-0000-000000000003',
  'b1000000-0000-0000-0000-000000000001',
  'seller', 'suspended', 'Seller operations review'
);

do $$
begin
  if public.marketplace_capability_is_active('b1000000-0000-0000-0000-000000000001', 'seller') then
    raise exception 'Seller suspension was not enforced';
  end if;
  if not public.marketplace_capability_is_active('b1000000-0000-0000-0000-000000000001', 'buyer') then
    raise exception 'Seller suspension incorrectly disabled Buyer capability';
  end if;
  if not public.marketplace_capability_is_active('b1000000-0000-0000-0000-000000000001', 'business') then
    raise exception 'Seller suspension incorrectly disabled Business capability';
  end if;
  if (select count(*) from public.marketplace_capability_state_events
      where user_id = 'b1000000-0000-0000-0000-000000000001'
        and capability = 'seller' and new_status = 'suspended') <> 1 then
    raise exception 'Seller suspension history was not recorded';
  end if;
  if (select count(*) from public.admin_audit_logs
      where admin_id = 'b3000000-0000-0000-0000-000000000003'
        and action = 'marketplace_capability_suspended'
        and target_id = 'b1000000-0000-0000-0000-000000000001:seller') <> 1 then
    raise exception 'Seller suspension admin audit row missing';
  end if;
end
$$;

set local role anon;
do $$
begin
  if (select count(*) from public.products where id = 'b4000000-0000-0000-0000-000000000004') <> 0 then
    raise exception 'Suspended Seller product remains public';
  end if;
end
$$;
reset role;

-- Seller cannot mutate catalogue while suspended.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.seller_set_product_publication('b4000000-0000-0000-0000-000000000004', false);
    raise exception 'Suspended Seller unexpectedly mutated catalogue';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- Buyer capability on the same account remains usable.
select public.buyer_get_or_create_cart() as cart_id \gset
select set_config('m3ops.cart_id', :'cart_id', false);
reset role;

-- Restore Seller, then product visibility returns without changing KYC/moderation.
select public.admin_set_marketplace_capability_state(
  'b3000000-0000-0000-0000-000000000003',
  'b1000000-0000-0000-0000-000000000001',
  'seller', 'active', 'Review completed'
);

set local role anon;
do $$
begin
  if (select count(*) from public.products where id = 'b4000000-0000-0000-0000-000000000004') <> 1 then
    raise exception 'Restored Seller product did not return to public catalogue';
  end if;
end
$$;
reset role;

-- Suspend Buyer only. Seller and Business remain effective, but new cart
-- commerce is blocked for the Buyer capability.
select public.admin_set_marketplace_capability_state(
  'b3000000-0000-0000-0000-000000000003',
  'b1000000-0000-0000-0000-000000000001',
  'buyer', 'suspended', 'Buyer payment-risk review'
);

do $$
begin
  if public.marketplace_capability_is_active('b1000000-0000-0000-0000-000000000001', 'buyer') then
    raise exception 'Buyer suspension was not enforced';
  end if;
  if not public.marketplace_capability_is_active('b1000000-0000-0000-0000-000000000001', 'seller')
     or not public.marketplace_capability_is_active('b1000000-0000-0000-0000-000000000001', 'business') then
    raise exception 'Buyer suspension incorrectly disabled another capability';
  end if;
end
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.buyer_set_cart_item(
      'b4000000-0000-0000-0000-000000000004',
      'b5000000-0000-0000-0000-000000000005',
      1
    );
    raise exception 'Suspended Buyer unexpectedly created cart commerce';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

select public.admin_set_marketplace_capability_state(
  'b3000000-0000-0000-0000-000000000003',
  'b1000000-0000-0000-0000-000000000001',
  'buyer', 'active', 'Buyer review completed'
);

-- Business suspension is independent as well.
select public.admin_set_marketplace_capability_state(
  'b3000000-0000-0000-0000-000000000003',
  'b1000000-0000-0000-0000-000000000001',
  'business', 'suspended', 'Business compliance review'
);
do $$
begin
  if public.marketplace_capability_is_active('b1000000-0000-0000-0000-000000000001', 'business') then
    raise exception 'Business suspension was not enforced';
  end if;
  if not public.marketplace_capability_is_active('b1000000-0000-0000-0000-000000000001', 'buyer')
     or not public.marketplace_capability_is_active('b1000000-0000-0000-0000-000000000001', 'seller') then
    raise exception 'Business suspension incorrectly disabled Buyer or Seller';
  end if;
end
$$;
select public.admin_set_marketplace_capability_state(
  'b3000000-0000-0000-0000-000000000003',
  'b1000000-0000-0000-0000-000000000001',
  'business', 'active', 'Business review completed'
);

-- EntizNet mapping is one-to-one and accepts only canonical Store capability
-- slugs. Snapshot claims remain evidence, not local authorization authority.
select public.upsert_entiznet_identity_link(
  'b1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  array['entiznetstore_buyer','entiznetstore_seller','entiznetstore_business']::text[],
  'cap-v1', 'entiznet_handoff', '{"test":true}'::jsonb
) as link_id \gset

do $$
begin
  if (select count(*) from public.entiznet_identity_links
      where store_user_id = 'b1000000-0000-0000-0000-000000000001'
        and entiznet_user_id = 'c1000000-0000-0000-0000-000000000001'
        and status = 'active') <> 1 then
    raise exception 'EntizNet identity link was not established';
  end if;

  begin
    perform public.upsert_entiznet_identity_link(
      'b2000000-0000-0000-0000-000000000002',
      'c1000000-0000-0000-0000-000000000001',
      array['entiznetstore_buyer']::text[], 'cap-v1', 'entiznet_handoff', '{}'::jsonb
    );
    raise exception 'One EntizNet identity linked to multiple Store users';
  exception when unique_violation then null;
  end;

  begin
    perform public.upsert_entiznet_identity_link(
      'b1000000-0000-0000-0000-000000000001',
      'c2000000-0000-0000-0000-000000000002',
      array['entiznetstore_buyer']::text[], 'cap-v1', 'entiznet_handoff', '{}'::jsonb
    );
    raise exception 'One Store identity linked to multiple EntizNet users';
  exception when unique_violation then null;
  end;

  begin
    perform public.upsert_entiznet_identity_link(
      'b2000000-0000-0000-0000-000000000002',
      'c2000000-0000-0000-0000-000000000002',
      array['admin']::text[], 'cap-v1', 'entiznet_handoff', '{}'::jsonb
    );
    raise exception 'Unsupported EntizNet capability snapshot was accepted';
  exception when sqlstate '22023' then null;
  end;
end
$$;

select public.revoke_entiznet_identity_link(
  'c1000000-0000-0000-0000-000000000001',
  'Upstream account revoked'
);
do $$
begin
  if (select status from public.entiznet_identity_links
      where entiznet_user_id = 'c1000000-0000-0000-0000-000000000001') <> 'revoked' then
    raise exception 'EntizNet revocation was not recorded';
  end if;
end
$$;

-- Handoff ledger rejects replay and open-redirect shaped return paths.
select public.register_entiznet_handoff(
  repeat('a', 64),
  'c1000000-0000-0000-0000-000000000001',
  'entiznet', 'entiznetstore', '/dashboard',
  array['entiznetstore_buyer','entiznetstore_seller']::text[],
  now(), now() + interval '5 minutes', '{"test":true}'::jsonb
) as handoff_id \gset
select set_config('m3ops.handoff_id', :'handoff_id', false);

do $$
begin
  begin
    perform public.register_entiznet_handoff(
      repeat('a', 64),
      'c1000000-0000-0000-0000-000000000001',
      'entiznet', 'entiznetstore', '/dashboard',
      array['entiznetstore_buyer']::text[],
      now(), now() + interval '5 minutes', '{}'::jsonb
    );
    raise exception 'Replayed EntizNet handoff was accepted';
  exception when unique_violation then null;
  end;

  begin
    perform public.register_entiznet_handoff(
      repeat('b', 64),
      'c1000000-0000-0000-0000-000000000001',
      'entiznet', 'entiznetstore', '//evil.example/path',
      array['entiznetstore_buyer']::text[],
      now(), now() + interval '5 minutes', '{}'::jsonb
    );
    raise exception 'Open-redirect shaped return path was accepted';
  exception when sqlstate '22023' then null;
  end;
end
$$;

select public.complete_entiznet_handoff(
  :'handoff_id'::uuid,
  'b1000000-0000-0000-0000-000000000001',
  'consumed', null
);

do $$
begin
  if (select status from public.entiznet_handoff_events
      where id = current_setting('m3ops.handoff_id')::uuid) <> 'consumed' then
    raise exception 'EntizNet handoff was not consumed';
  end if;

  begin
    perform public.complete_entiznet_handoff(
      current_setting('m3ops.handoff_id')::uuid,
      'b1000000-0000-0000-0000-000000000001',
      'consumed', null
    );
    raise exception 'Consumed EntizNet handoff was completed twice';
  exception when sqlstate '22023' then null;
  end;
end
$$;

-- Admin search/detail must reflect the same capability/link state and remain
-- trusted-worker-only.
do $$
declare
  v_detail jsonb;
begin
  if has_function_privilege('authenticated', 'public.admin_search_marketplace_accounts(uuid,text,text,text,integer,integer)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.admin_search_marketplace_accounts(uuid,text,text,text,integer,integer)', 'EXECUTE') then
    raise exception 'Admin account-search execution boundary is incorrect';
  end if;

  select public.admin_get_marketplace_account(
    'b3000000-0000-0000-0000-000000000003',
    'b1000000-0000-0000-0000-000000000001'
  ) into v_detail;

  if v_detail->'buyer'->>'status' <> 'active'
     or v_detail->'seller'->>'status' <> 'active'
     or v_detail->'business'->>'status' <> 'active'
     or v_detail->'entiznetLink'->>'status' <> 'revoked' then
    raise exception 'Admin account detail does not reflect canonical capability/link state: %', v_detail;
  end if;
end
$$;

rollback;

select 'M3 identity and marketplace operations regression suite passed' as result;
