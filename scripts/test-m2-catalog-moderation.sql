\set ON_ERROR_STOP on

-- M2 catalogue/moderation authorization regression suite.
-- Runs only against the disposable local Supabase database created by CI.
-- All fixtures roll back.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '91000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'm2-seller-one@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '92000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'm2-seller-two@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '93000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'm2-admin@test.invalid', '', now(), '{"role":"admin"}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles_buyer(id, display_name)
values
  ('91000000-0000-0000-0000-000000000001', 'M2 Seller One'),
  ('92000000-0000-0000-0000-000000000002', 'M2 Seller Two');

insert into public.profiles_seller(
  id, storefront_name, business_type, verification_status, shipping_policy, return_policy
)
values
  (
    '91000000-0000-0000-0000-000000000001',
    'M2 Seller One Store',
    'individual',
    'verified',
    'Tracked shipping with clear delivery expectations.',
    'Returns accepted under the Seller return policy.'
  ),
  (
    '92000000-0000-0000-0000-000000000002',
    'M2 Seller Two Store',
    'individual',
    'verified',
    'Tracked shipping with clear delivery expectations.',
    'Returns accepted under the Seller return policy.'
  );

-- M2 media fixtures must represent the same provenance that production now
-- requires: a live owned Storage object plus clean quarantine/scan evidence.
insert into storage.objects(bucket_id, name, metadata)
values (
  'product-media',
  '91000000-0000-0000-0000-000000000001/11111111-1111-4111-8111-111111111111.webp',
  '{"mimetype":"image/webp","size":128}'::jsonb
);

insert into public.upload_scan_jobs(
  id, actor_id, purpose, quarantine_path, destination_bucket, destination_path,
  declared_mime, verified_mime, byte_size, sha256, status, scanner,
  scanner_version, scanner_result_code, scanned_at, promoted_at
)
values (
  '91111111-1111-4111-8111-111111111111',
  '91000000-0000-0000-0000-000000000001',
  'product_media',
  '91000000-0000-0000-0000-000000000001/product_media/91111111-1111-4111-8111-111111111111.webp',
  'product-media',
  '91000000-0000-0000-0000-000000000001/11111111-1111-4111-8111-111111111111.webp',
  'image/webp',
  'image/webp',
  128,
  repeat('9', 64),
  'clean',
  'ci-m2-regression',
  '1',
  'clean',
  now(),
  now()
);

-- Store slugs are persisted, clean and unique instead of derived by scanning.
do $$
declare
  v_slug_one text;
  v_slug_two text;
begin
  select store_slug into v_slug_one from public.profiles_seller where id = '91000000-0000-0000-0000-000000000001';
  select store_slug into v_slug_two from public.profiles_seller where id = '92000000-0000-0000-0000-000000000002';
  if v_slug_one is null or v_slug_two is null or v_slug_one = v_slug_two then
    raise exception 'Stable unique store_slug provisioning failed: %, %', v_slug_one, v_slug_two;
  end if;
  if v_slug_one <> 'm2-seller-one-store' then
    raise exception 'Unexpected canonical store slug: %', v_slug_one;
  end if;
end
$$;

-- Old save RPCs are no longer Seller publication escape hatches.
do $$
begin
  if has_function_privilege(
    'authenticated',
    'public.seller_save_product(uuid,text,text,numeric,numeric,text,uuid[],text[],integer)',
    'EXECUTE'
  ) then
    raise exception 'authenticated can still execute legacy seller_save_product';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.seller_save_product_v2(uuid,text,text,numeric,numeric,text,uuid[],text[],jsonb)',
    'EXECUTE'
  ) then
    raise exception 'authenticated can still execute legacy seller_save_product_v2';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.admin_review_product(uuid,uuid,text,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.admin_review_product(uuid,uuid,text,text)',
    'EXECUTE'
  ) then
    raise exception 'Browser role can execute admin_review_product';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.admin_review_product(uuid,uuid,text,text)',
    'EXECUTE'
  ) then
    raise exception 'service_role is missing admin_review_product execution';
  end if;
end
$$;

-- Seller one creates a rich draft through the canonical RPC.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated","iss":"https://example.supabase.co/auth/v1"}', true);

select public.seller_save_product_v3(
  null,
  'M2 Moderated Product',
  'Complete product description for the M2 moderation regression.',
  'Short M2 product description',
  'physical',
  129.99,
  159.99,
  40.00,
  null,
  array['b9ec6994-3765-4a06-a072-6bcf6b619645']::uuid[],
  array['https://example.supabase.co/storage/v1/object/public/product-media/91000000-0000-0000-0000-000000000001/11111111-1111-4111-8111-111111111111.webp'],
  '[{"title":"Default","sku":"M2-ONE","price":129.99,"compareAtPrice":159.99,"costPerItem":40,"trackInventory":true,"inventoryQuantity":12,"inventoryPolicy":"deny","weightGrams":250,"requiresShipping":true,"isActive":true}]'::jsonb,
  true,
  false,
  true,
  true,
  250,
  'silicone',
  18,
  array['premium','m2'],
  array['moderated','premium']
) as product_id \gset

-- psql variables are not interpolated safely inside dollar-quoted DO bodies.
-- Persist the generated ID in a session GUC for all procedural assertions.
select set_config('entiznetstore.m2_product_id', :'product_id', false);

-- Direct table mutation is forbidden even for the owning verified Seller.
do $$
declare
  v_product_id uuid := current_setting('entiznetstore.m2_product_id')::uuid;
begin
  begin
    update public.products
    set status = 'active', moderation_status = 'approved'
    where id = v_product_id;
    raise exception 'Seller unexpectedly bypassed RPC-only product mutation';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.product_media(product_id, type, url)
    values (v_product_id, 'image', 'https://example.invalid/bypass.webp');
    raise exception 'Seller unexpectedly bypassed RPC-only child mutation';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

-- Draft/not-submitted product is visible to owner but not anonymous users.
do $$
declare
  v_product_id uuid := current_setting('entiznetstore.m2_product_id')::uuid;
  v_own integer;
begin
  select count(*) into v_own from public.products where id = v_product_id;
  if v_own <> 1 then raise exception 'Seller cannot read own draft'; end if;
end
$$;

reset role;
set local role anon;
do $$
declare
  v_product_id uuid := current_setting('entiznetstore.m2_product_id')::uuid;
  v_public integer;
begin
  select count(*) into v_public from public.products where id = v_product_id;
  if v_public <> 0 then raise exception 'Unreviewed product leaked publicly'; end if;
end
$$;

-- Cross-seller RPC mutation fails.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"92000000-0000-0000-0000-000000000002","role":"authenticated","iss":"https://example.supabase.co/auth/v1"}', true);

do $$
declare
  v_product_id uuid := current_setting('entiznetstore.m2_product_id')::uuid;
begin
  begin
    perform public.seller_save_product_v3(
      v_product_id,
      'Cross seller overwrite', '', '', 'physical', 10, null, null, null,
      array['b9ec6994-3765-4a06-a072-6bcf6b619645']::uuid[],
      array['https://example.invalid/cross.webp'],
      '[{"title":"Default","price":10,"inventoryQuantity":1}]'::jsonb,
      true, false, true, true, null, null, 18, '{}'::text[], '{}'::text[]
    );
    raise exception 'Cross-seller product mutation unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

-- Seller one submits the complete product for moderation.
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated","iss":"https://example.supabase.co/auth/v1"}', true);
select public.seller_submit_product_for_review(:'product_id'::uuid);

reset role;
do $$
declare
  v_product_id uuid := current_setting('entiznetstore.m2_product_id')::uuid;
  v_moderation text;
  v_status text;
  v_events integer;
begin
  select moderation_status, status into v_moderation, v_status
  from public.products where id = v_product_id;
  select count(*) into v_events
  from public.product_moderation_events
  where product_id = v_product_id and action = 'submitted';
  if v_moderation <> 'pending' or v_status <> 'draft' or v_events <> 1 then
    raise exception 'Product submission transition failed: moderation %, status %, events %', v_moderation, v_status, v_events;
  end if;
end
$$;

-- Pending review still cannot be seen by an anonymous shopper.
set local role anon;
do $$
declare
  v_product_id uuid := current_setting('entiznetstore.m2_product_id')::uuid;
  v_public integer;
begin
  select count(*) into v_public from public.products where id = v_product_id;
  if v_public <> 0 then raise exception 'Pending product leaked publicly'; end if;
end
$$;

-- Trusted Admin approval atomically makes the product public and records audit.
reset role;
set local role service_role;
select public.admin_review_product(
  '93000000-0000-0000-0000-000000000003',
  :'product_id'::uuid,
  'approved',
  'M2 regression approval'
);

reset role;
do $$
declare
  v_product_id uuid := current_setting('entiznetstore.m2_product_id')::uuid;
  v_moderation text;
  v_status text;
  v_admin_events integer;
  v_audits integer;
begin
  select moderation_status, status into v_moderation, v_status
  from public.products where id = v_product_id;
  select count(*) into v_admin_events from public.product_moderation_events
  where product_id = v_product_id and action = 'approved';
  select count(*) into v_audits from public.admin_audit_logs
  where action = 'product_moderation' and target_id = v_product_id::text;
  if v_moderation <> 'approved' or v_status <> 'active' or v_admin_events <> 1 or v_audits <> 1 then
    raise exception 'Atomic Admin product approval failed: moderation %, status %, events %, audits %',
      v_moderation, v_status, v_admin_events, v_audits;
  end if;
end
$$;

-- Approved product and its child catalogue rows are visible publicly.
set local role anon;
do $$
declare
  v_product_id uuid := current_setting('entiznetstore.m2_product_id')::uuid;
  v_products integer;
  v_variants integer;
  v_media integer;
  v_categories integer;
begin
  select count(*) into v_products from public.products where id = v_product_id;
  select count(*) into v_variants from public.product_variants where product_id = v_product_id;
  select count(*) into v_media from public.product_media where product_id = v_product_id;
  select count(*) into v_categories from public.product_categories where product_id = v_product_id;
  if v_products <> 1 or v_variants < 1 or v_media < 1 or v_categories < 1 then
    raise exception 'Approved catalogue visibility failed: products %, variants %, media %, categories %',
      v_products, v_variants, v_media, v_categories;
  end if;
end
$$;

-- Seller can unpublish/re-publish an approved unchanged listing without bypassing review.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated","iss":"https://example.supabase.co/auth/v1"}', true);
select public.seller_set_product_publication(:'product_id'::uuid, false);

reset role;
set local role anon;
do $$
declare
  v_product_id uuid := current_setting('entiznetstore.m2_product_id')::uuid;
  v_public integer;
begin
  select count(*) into v_public from public.products where id = v_product_id;
  if v_public <> 0 then raise exception 'Unpublished approved product remained public'; end if;
end
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated","iss":"https://example.supabase.co/auth/v1"}', true);
select public.seller_set_product_publication(:'product_id'::uuid, true);

-- Any Seller edit invalidates approval and unpublishes immediately.
select public.seller_save_product_v3(
  :'product_id'::uuid,
  'M2 Moderated Product Edited',
  'Edited description forces a fresh moderation cycle.',
  'Edited short description',
  'physical',
  139.99,
  169.99,
  42.00,
  null,
  array['b9ec6994-3765-4a06-a072-6bcf6b619645']::uuid[],
  array['https://example.supabase.co/storage/v1/object/public/product-media/91000000-0000-0000-0000-000000000001/11111111-1111-4111-8111-111111111111.webp'],
  '[{"title":"Default","sku":"M2-ONE-EDIT","price":139.99,"inventoryQuantity":10,"inventoryPolicy":"deny","trackInventory":true,"requiresShipping":true,"isActive":true}]'::jsonb,
  true, false, true, true, 250, 'silicone', 18,
  array['premium','edited'], array['moderated','edited']
);

reset role;
do $$
declare
  v_product_id uuid := current_setting('entiznetstore.m2_product_id')::uuid;
  v_moderation text;
  v_status text;
  v_edits integer;
begin
  select moderation_status, status into v_moderation, v_status
  from public.products where id = v_product_id;
  select count(*) into v_edits from public.product_moderation_events
  where product_id = v_product_id and action = 'edited';
  if v_moderation <> 'not_submitted' or v_status <> 'draft' or v_edits < 1 then
    raise exception 'Seller edit did not invalidate product approval';
  end if;
end
$$;

set local role anon;
do $$
declare
  v_product_id uuid := current_setting('entiznetstore.m2_product_id')::uuid;
  v_public integer;
begin
  select count(*) into v_public from public.products where id = v_product_id;
  if v_public <> 0 then raise exception 'Edited product leaked publicly before re-review'; end if;
end
$$;

-- Seller-owned moderation history is isolated from another Seller.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"92000000-0000-0000-0000-000000000002","role":"authenticated","iss":"https://example.supabase.co/auth/v1"}', true);

do $$
declare
  v_product_id uuid := current_setting('entiznetstore.m2_product_id')::uuid;
  v_events integer;
begin
  select count(*) into v_events from public.product_moderation_events
  where product_id = v_product_id;
  if v_events <> 0 then raise exception 'Cross-seller moderation history leaked'; end if;
end
$$;

rollback;

select 'M2 catalogue/moderation regression suite passed' as result;