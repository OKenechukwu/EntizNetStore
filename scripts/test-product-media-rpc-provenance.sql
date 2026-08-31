\set ON_ERROR_STOP on

-- Direct-RPC adversarial regression for the product-media trust boundary.
-- Runs only against the disposable local Supabase database created by CI.
-- Synthetic JWT claims use an HTTPS Supabase origin so the test preserves the
-- existing seller_save_product_v3 HTTPS-only contract while exercising the new
-- database provenance trigger independently of network transport.

begin;

do $$
declare
  v_security_definer boolean;
  v_config text[];
  v_trigger_count integer;
begin
  select p.prosecdef, p.proconfig
    into v_security_definer, v_config
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app_private'
    and p.proname = 'guard_product_media_provenance';

  if not found then
    raise exception 'product-media provenance guard function is missing';
  end if;
  if not v_security_definer then
    raise exception 'product-media provenance guard must be SECURITY DEFINER';
  end if;
  if v_config is null or not ('search_path=pg_catalog' = any(v_config)) then
    raise exception 'product-media provenance guard search_path is not hardened: %', v_config;
  end if;
  if has_function_privilege('anon', 'app_private.guard_product_media_provenance()', 'EXECUTE')
     or has_function_privilege('authenticated', 'app_private.guard_product_media_provenance()', 'EXECUTE') then
    raise exception 'browser role can execute product-media provenance guard directly';
  end if;

  select count(*) into v_trigger_count
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'product_media'
    and t.tgname = 'trg_guard_product_media_provenance'
    and not t.tgisinternal
    and t.tgenabled = 'O';

  if v_trigger_count <> 1 then
    raise exception 'product-media provenance trigger missing or disabled';
  end if;
end
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'media-rpc-seller-a@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a2000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'media-rpc-seller-b@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles_buyer(id, display_name)
values
  ('a1000000-0000-4000-8000-000000000001', 'Media RPC Seller A'),
  ('a2000000-0000-4000-8000-000000000002', 'Media RPC Seller B');

insert into public.profiles_seller(
  id, storefront_name, business_type, verification_status, shipping_policy, return_policy
)
values
  ('a1000000-0000-4000-8000-000000000001', 'Media RPC Seller A Store', 'individual', 'verified',
   'Tracked shipping for the isolated provenance regression.',
   'Returns accepted under the isolated provenance regression policy.'),
  ('a2000000-0000-4000-8000-000000000002', 'Media RPC Seller B Store', 'individual', 'verified',
   'Tracked shipping for the isolated provenance regression.',
   'Returns accepted under the isolated provenance regression policy.');

-- One canonical Seller A object with clean scan evidence.
insert into storage.objects(bucket_id, name, metadata)
values (
  'product-media',
  'a1000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.webp',
  '{"mimetype":"image/webp","size":128}'::jsonb
);
insert into public.upload_scan_jobs(
  id, actor_id, purpose, quarantine_path, destination_bucket, destination_path,
  declared_mime, verified_mime, byte_size, sha256, status, scanner,
  scanner_version, scanner_result_code, scanned_at, promoted_at
) values (
  'b1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'product_media',
  'a1000000-0000-4000-8000-000000000001/product_media/b1000000-0000-4000-8000-000000000001.webp',
  'product-media',
  'a1000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.webp',
  'image/webp', 'image/webp', 128, repeat('1',64), 'clean',
  'ci-provenance-regression', '1', 'clean', now(), now()
);

-- Seller B has a valid promoted object, which Seller A must never reuse.
insert into storage.objects(bucket_id, name, metadata)
values (
  'product-media',
  'a2000000-0000-4000-8000-000000000002/22222222-2222-4222-8222-222222222222.jpg',
  '{"mimetype":"image/jpeg","size":128}'::jsonb
);
insert into public.upload_scan_jobs(
  id, actor_id, purpose, quarantine_path, destination_bucket, destination_path,
  declared_mime, verified_mime, byte_size, sha256, status, scanner,
  scanner_version, scanner_result_code, scanned_at, promoted_at
) values (
  'b2000000-0000-4000-8000-000000000002',
  'a2000000-0000-4000-8000-000000000002',
  'product_media',
  'a2000000-0000-4000-8000-000000000002/product_media/b2000000-0000-4000-8000-000000000002.jpg',
  'product-media',
  'a2000000-0000-4000-8000-000000000002/22222222-2222-4222-8222-222222222222.jpg',
  'image/jpeg', 'image/jpeg', 128, repeat('2',64), 'clean',
  'ci-provenance-regression', '1', 'clean', now(), now()
);

-- Seller A object that exists but has no scanner provenance.
insert into storage.objects(bucket_id, name, metadata)
values (
  'product-media',
  'a1000000-0000-4000-8000-000000000001/33333333-3333-4333-8333-333333333333.png',
  '{"mimetype":"image/png","size":128}'::jsonb
);

-- Seller A scan evidence whose promoted object is now missing.
insert into public.upload_scan_jobs(
  id, actor_id, purpose, quarantine_path, destination_bucket, destination_path,
  declared_mime, verified_mime, byte_size, sha256, status, scanner,
  scanner_version, scanner_result_code, scanned_at, promoted_at
) values (
  'b3000000-0000-4000-8000-000000000003',
  'a1000000-0000-4000-8000-000000000001',
  'product_media',
  'a1000000-0000-4000-8000-000000000001/product_media/b3000000-0000-4000-8000-000000000003.png',
  'product-media',
  'a1000000-0000-4000-8000-000000000001/44444444-4444-4444-8444-444444444444.png',
  'image/png', 'image/png', 128, repeat('3',64), 'clean',
  'ci-provenance-regression', '1', 'clean', now(), now()
);

-- Seller A scan/object pair with deliberately inconsistent MIME/extension.
insert into storage.objects(bucket_id, name, metadata)
values (
  'product-media',
  'a1000000-0000-4000-8000-000000000001/55555555-5555-4555-8555-555555555555.jpg',
  '{"mimetype":"image/png","size":128}'::jsonb
);
insert into public.upload_scan_jobs(
  id, actor_id, purpose, quarantine_path, destination_bucket, destination_path,
  declared_mime, verified_mime, byte_size, sha256, status, scanner,
  scanner_version, scanner_result_code, scanned_at, promoted_at
) values (
  'b5000000-0000-4000-8000-000000000005',
  'a1000000-0000-4000-8000-000000000001',
  'product_media',
  'a1000000-0000-4000-8000-000000000001/product_media/b5000000-0000-4000-8000-000000000005.jpg',
  'product-media',
  'a1000000-0000-4000-8000-000000000001/55555555-5555-4555-8555-555555555555.jpg',
  'image/png', 'image/png', 128, repeat('5',64), 'clean',
  'ci-provenance-regression', '1', 'clean', now(), now()
);

create or replace function pg_temp.save_media(p_product_id uuid, p_url text)
returns uuid
language sql
as $$
  select public.seller_save_product_v3(
    p_product_id,
    'Direct RPC media provenance product',
    'CI-only product used to prove that direct RPC calls cannot bypass scanned media provenance.',
    'CI-only media provenance product',
    'physical', 19.99, null, null, null, '{}'::uuid[],
    case when p_url is null then '{}'::text[] else array[p_url] end,
    '[{"title":"Default","sku":"MEDIA-RPC-CI","price":19.99,"trackInventory":true,"inventoryQuantity":3,"inventoryPolicy":"deny","requiresShipping":true,"isActive":true}]'::jsonb,
    true, false, true, true, 100, null, 18,
    array['ci-provenance'], array['ci-provenance']
  );
$$;

create or replace function pg_temp.expect_media_rejected(
  p_product_id uuid,
  p_url text,
  p_expected_message text
)
returns void
language plpgsql
as $$
begin
  begin
    perform pg_temp.save_media(p_product_id, p_url);
  exception when others then
    if position(p_expected_message in sqlerrm) = 0 then
      raise exception 'Expected media rejection containing %, got %', p_expected_message, sqlerrm;
    end if;
    return;
  end;
  raise exception 'Media URL unexpectedly passed provenance guard: %', p_url;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","iss":"https://example.supabase.co/auth/v1"}',
  true
);

select pg_temp.save_media(null, null) as product_id \gset
select set_config('entiznetstore.media_rpc_product_id', :'product_id', false);

select pg_temp.expect_media_rejected(
  :'product_id'::uuid,
  'https://evil.example/storage/v1/object/public/product-media/a1000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.webp',
  'product_media_url_not_canonical'
);
select pg_temp.expect_media_rejected(
  :'product_id'::uuid,
  'https://example.supabase.co/storage/v1/object/public/product-media/a2000000-0000-4000-8000-000000000002/22222222-2222-4222-8222-222222222222.jpg',
  'product_media_path_not_owned'
);
select pg_temp.expect_media_rejected(
  :'product_id'::uuid,
  'https://example.supabase.co/storage/v1/object/public/product-media/a1000000-0000-4000-8000-000000000001/33333333-3333-4333-8333-333333333333.png',
  'product_media_scan_provenance_required'
);
select pg_temp.expect_media_rejected(
  :'product_id'::uuid,
  'https://example.supabase.co/storage/v1/object/public/product-media/a1000000-0000-4000-8000-000000000001/44444444-4444-4444-8444-444444444444.png',
  'product_media_object_missing'
);
select pg_temp.expect_media_rejected(
  :'product_id'::uuid,
  'https://example.supabase.co/storage/v1/object/public/product-media/a1000000-0000-4000-8000-000000000001/55555555-5555-4555-8555-555555555555.jpg',
  'product_media_extension_mismatch'
);
select pg_temp.expect_media_rejected(
  :'product_id'::uuid,
  'https://example.supabase.co/storage/v1/object/public/product-media/a1000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.webp?download=1',
  'product_media_url_not_canonical'
);

-- Missing issuer must fail closed even for an otherwise canonical URL.
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select pg_temp.expect_media_rejected(
  :'product_id'::uuid,
  'https://example.supabase.co/storage/v1/object/public/product-media/a1000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.webp',
  'product_media_auth_issuer_invalid'
);

-- Canonical scanned/live owned media remains valid.
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","iss":"https://example.supabase.co/auth/v1"}',
  true
);
select pg_temp.save_media(
  :'product_id'::uuid,
  'https://example.supabase.co/storage/v1/object/public/product-media/a1000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.webp'
);

do $$
declare
  v_product_id uuid := current_setting('entiznetstore.media_rpc_product_id')::uuid;
  v_count integer;
  v_url text;
begin
  select count(*), min(url)
    into v_count, v_url
  from public.product_media
  where product_id = v_product_id;

  if v_count <> 1 then
    raise exception 'Expected one canonical product-media row after valid direct RPC, got %', v_count;
  end if;
  if v_url <> 'https://example.supabase.co/storage/v1/object/public/product-media/a1000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.webp' then
    raise exception 'Unexpected canonical product-media URL persisted: %', v_url;
  end if;
end
$$;

rollback;

\echo 'Product-media direct-RPC provenance regression passed'
