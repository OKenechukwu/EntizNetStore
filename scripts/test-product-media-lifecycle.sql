\set ON_ERROR_STOP on

-- Product-media retirement/reference-integrity regression.
-- Runs only against the disposable local Supabase database created by CI.

begin;

do $$
declare
  v_guard_def text;
  v_claim_def text;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'upload_scan_jobs'
      and column_name = 'retired_at'
      and data_type = 'timestamp with time zone'
  ) then
    raise exception 'upload_scan_jobs.retired_at is missing';
  end if;

  select pg_get_functiondef(p.oid)
    into v_guard_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app_private'
    and p.proname = 'guard_product_media_provenance';

  select pg_get_functiondef(p.oid)
    into v_claim_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'service_claim_product_media_orphan'
    and pg_get_function_identity_arguments(p.oid) = 'p_actor_id uuid, p_destination_path text';

  if v_guard_def is null or position('127[.]0[.]0[.]1' in v_guard_def) = 0 then
    raise exception 'product-media guard loopback issuer contract drifted';
  end if;
  if position('pg_advisory_xact_lock' in v_guard_def) = 0
     or position('retired_at is null' in lower(v_guard_def)) = 0 then
    raise exception 'product-media guard is missing lifecycle serialization/retirement enforcement';
  end if;
  if v_claim_def is null or position('pg_advisory_xact_lock' in v_claim_def) = 0 then
    raise exception 'service orphan claim is missing lifecycle serialization';
  end if;
  if has_function_privilege(
      'anon',
      'public.service_claim_product_media_orphan(uuid,text)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.service_claim_product_media_orphan(uuid,text)',
      'EXECUTE'
    ) then
    raise exception 'browser role can execute service product-media orphan claim';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.service_claim_product_media_orphan(uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'service_role cannot execute product-media orphan claim';
  end if;
end
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'c1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'media-lifecycle-a@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'c2000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'media-lifecycle-b@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles_buyer(id, display_name)
values
  ('c1000000-0000-4000-8000-000000000001', 'Media Lifecycle Seller A'),
  ('c2000000-0000-4000-8000-000000000002', 'Media Lifecycle Seller B');

insert into public.profiles_seller(
  id, storefront_name, business_type, verification_status, shipping_policy, return_policy
)
values
  ('c1000000-0000-4000-8000-000000000001', 'Media Lifecycle A Store', 'individual', 'verified',
   'Tracked shipping for isolated lifecycle regression.',
   'Returns accepted for isolated lifecycle regression.'),
  ('c2000000-0000-4000-8000-000000000002', 'Media Lifecycle B Store', 'individual', 'verified',
   'Tracked shipping for isolated lifecycle regression.',
   'Returns accepted for isolated lifecycle regression.');

insert into storage.objects(bucket_id, name, metadata)
values (
  'product-media',
  'c1000000-0000-4000-8000-000000000001/77777777-7777-4777-8777-777777777777.webp',
  '{"mimetype":"image/webp","size":128}'::jsonb
);

insert into public.upload_scan_jobs(
  id, actor_id, purpose, quarantine_path, destination_bucket, destination_path,
  declared_mime, verified_mime, byte_size, sha256, status, scanner,
  scanner_version, scanner_result_code, scanned_at, promoted_at
) values (
  'c7000000-0000-4000-8000-000000000007',
  'c1000000-0000-4000-8000-000000000001',
  'product_media',
  'c1000000-0000-4000-8000-000000000001/product_media/c7000000-0000-4000-8000-000000000007.webp',
  'product-media',
  'c1000000-0000-4000-8000-000000000001/77777777-7777-4777-8777-777777777777.webp',
  'image/webp', 'image/webp', 128, repeat('7',64), 'clean',
  'ci-lifecycle-regression', '1', 'clean', now(), now()
);

create or replace function pg_temp.lifecycle_save(p_product_id uuid, p_url text, p_title text)
returns uuid
language sql
as $$
  select public.seller_save_product_v3(
    p_product_id,
    p_title,
    'CI-only product used to prove reference-safe product-media retirement.',
    'CI lifecycle regression',
    'physical', 29.99, null, null, null, '{}'::uuid[],
    case when p_url is null then '{}'::text[] else array[p_url] end,
    '[{"title":"Default","price":29.99,"trackInventory":true,"inventoryQuantity":2,"inventoryPolicy":"deny","requiresShipping":true,"isActive":true}]'::jsonb,
    true, false, true, true, 100, null, 18,
    array['ci-lifecycle'], array['ci-lifecycle']
  );
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","iss":"https://example.supabase.co/auth/v1"}',
  true
);

select pg_temp.lifecycle_save(
  null,
  'https://example.supabase.co/storage/v1/object/public/product-media/c1000000-0000-4000-8000-000000000001/77777777-7777-4777-8777-777777777777.webp',
  'Lifecycle Product One'
) as product_one \gset
select pg_temp.lifecycle_save(
  null,
  'https://example.supabase.co/storage/v1/object/public/product-media/c1000000-0000-4000-8000-000000000001/77777777-7777-4777-8777-777777777777.webp',
  'Lifecycle Product Two'
) as product_two \gset

reset role;
set local role service_role;
select public.service_claim_product_media_orphan(
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001/77777777-7777-4777-8777-777777777777.webp'
) as claim_while_two_refs \gset
\if :'claim_while_two_refs' != 'referenced'
  \error expected referenced claim while two catalogue rows exist
\endif

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","iss":"https://example.supabase.co/auth/v1"}',
  true
);
select pg_temp.lifecycle_save(:'product_one'::uuid, null, 'Lifecycle Product One Without Media');

reset role;
set local role service_role;
select public.service_claim_product_media_orphan(
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001/77777777-7777-4777-8777-777777777777.webp'
) as claim_while_one_ref \gset
\if :'claim_while_one_ref' != 'referenced'
  \error expected referenced claim while one catalogue row exists
\endif

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","iss":"https://example.supabase.co/auth/v1"}',
  true
);
select pg_temp.lifecycle_save(:'product_two'::uuid, null, 'Lifecycle Product Two Without Media');

reset role;
set local role service_role;
select public.service_claim_product_media_orphan(
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001/77777777-7777-4777-8777-777777777777.webp'
) as orphan_claim \gset
\if :'orphan_claim' != 'claimed'
  \error expected orphan claim after final catalogue reference is removed
\endif

select public.service_claim_product_media_orphan(
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001/77777777-7777-4777-8777-777777777777.webp'
) as retry_claim \gset
\if :'retry_claim' != 'claimed'
  \error expected retired orphan claim to remain retryable after physical-delete failure
\endif

select public.service_claim_product_media_orphan(
  'c2000000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000001/77777777-7777-4777-8777-777777777777.webp'
) as cross_actor_claim \gset
\if :'cross_actor_claim' != 'invalid_path'
  \error expected cross-actor orphan claim to fail closed
\endif

reset role;
do $$
begin
  if not exists (
    select 1 from public.upload_scan_jobs
    where id = 'c7000000-0000-4000-8000-000000000007'
      and retired_at is not null
  ) then
    raise exception 'orphan claim did not retire scanner provenance';
  end if;
end
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","iss":"https://example.supabase.co/auth/v1"}',
  true
);

do $$
begin
  begin
    perform pg_temp.lifecycle_save(
      null,
      'https://example.supabase.co/storage/v1/object/public/product-media/c1000000-0000-4000-8000-000000000001/77777777-7777-4777-8777-777777777777.webp',
      'Retired Media Reattachment Attempt'
    );
  exception when others then
    if position('product_media_scan_provenance_required' in sqlerrm) = 0 then
      raise exception 'retired media rejected for wrong reason: %', sqlerrm;
    end if;
    return;
  end;
  raise exception 'retired media unexpectedly reattached to a product';
end
$$;

rollback;

\echo 'Product-media lifecycle integrity regression passed'
