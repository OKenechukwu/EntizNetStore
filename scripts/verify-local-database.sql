\set ON_ERROR_STOP on

-- EntizNetStore fresh-environment reproduction assertions.
-- Run against a newly reset local Supabase database after all repository
-- migrations and supabase/seed.sql have been applied.

do $$
declare
  v_public_tables integer;
  v_rls_tables integer;
  v_no_policy_tables integer;
  v_categories integer;
  v_brands integer;
begin
  select count(*) into v_public_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r';

  if v_public_tables <> 31 then
    raise exception 'Expected 31 public tables, found %', v_public_tables;
  end if;

  select count(*) into v_rls_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity;

  if v_rls_tables <> 31 then
    raise exception 'Expected RLS on all 31 public tables, found %', v_rls_tables;
  end if;

  select count(*) into v_no_policy_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relrowsecurity
    and not exists (
      select 1 from pg_policy p where p.polrelid = c.oid
    );

  -- M1 adds scoped read policies to KYC documents, KYC requests, and message
  -- attachments, reducing the intentional deny-by-default count from 12 to 9.
  if v_no_policy_tables <> 9 then
    raise exception 'Expected 9 intentional deny-by-default RLS tables, found %', v_no_policy_tables;
  end if;

  select count(*) into v_categories from public.categories;
  select count(*) into v_brands from public.brands;

  if v_categories <> 16 then
    raise exception 'Expected 16 seeded categories, found %', v_categories;
  end if;
  if v_brands <> 6 then
    raise exception 'Expected 6 seeded brands, found %', v_brands;
  end if;
end
$$;

-- Expected public table set. EXCEPT in either direction must be empty.
with expected(name) as (
  values
    ('addresses'), ('admin_audit_logs'), ('brands'), ('categories'),
    ('content_pages'), ('conversation_keys'), ('conversations'),
    ('escrow_transactions'), ('featured_products'), ('inventory_reservations'),
    ('kyc_documents'), ('kyc_verification_requests'), ('message_attachments'),
    ('messages'), ('notifications'), ('order_items'), ('orders'),
    ('payment_sessions'), ('payment_webhook_events'),
    ('payout_items'), ('payout_provider_events'), ('payout_requests'),
    ('product_categories'), ('product_media'), ('product_variants'), ('products'),
    ('profiles_business'), ('profiles_buyer'), ('profiles_seller'),
    ('profiles_seller_private'), ('reviews')
), actual(name) as (
  select c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
), delta as (
  (select name from expected except select name from actual)
  union all
  (select name from actual except select name from expected)
)
select case
  when exists (select 1 from delta)
  then pg_catalog.set_config('entiznetstore.invalid_table_delta', 'true', false)
  else pg_catalog.set_config('entiznetstore.invalid_table_delta', 'false', false)
end;

do $$
begin
  if current_setting('entiznetstore.invalid_table_delta', true) = 'true' then
    raise exception 'Public table set differs from canonical baseline';
  end if;
end
$$;

-- Storage buckets required by production architecture.
do $$
declare
  bucket_public boolean;
  bucket_limit bigint;
  bucket_mimes text[];
begin
  select public, file_size_limit, allowed_mime_types
    into bucket_public, bucket_limit, bucket_mimes
  from storage.buckets
  where id = 'kyc-documents';

  if not found then
    raise exception 'Required private KYC storage bucket is missing';
  end if;
  if bucket_public then
    raise exception 'KYC storage bucket must remain private';
  end if;
  if bucket_limit is distinct from 10485760 then
    raise exception 'KYC storage bucket must enforce a 10MB file limit, found %', bucket_limit;
  end if;
  if not coalesce(bucket_mimes @> array[
    'application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'
  ]::text[], false) then
    raise exception 'KYC storage bucket MIME allow-list differs from baseline';
  end if;

  select public, file_size_limit, allowed_mime_types
    into bucket_public, bucket_limit, bucket_mimes
  from storage.buckets
  where id = 'product-media';

  if not found then
    raise exception 'Required product-media storage bucket is missing';
  end if;
  if not bucket_public then
    raise exception 'Product media bucket must be public for storefront rendering';
  end if;
  if bucket_limit is distinct from 10485760 then
    raise exception 'Product media bucket must enforce a 10MB file limit, found %', bucket_limit;
  end if;
  if not coalesce(bucket_mimes @> array[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp'
  ]::text[], false) then
    raise exception 'Product media MIME allow-list differs from baseline';
  end if;

  select public, file_size_limit, allowed_mime_types
    into bucket_public, bucket_limit, bucket_mimes
  from storage.buckets
  where id = 'seller-branding';

  if not found then
    raise exception 'Required seller-branding storage bucket is missing';
  end if;
  if not bucket_public then
    raise exception 'Seller branding bucket must be public for storefront rendering';
  end if;
  if bucket_limit is distinct from 5242880 then
    raise exception 'Seller branding bucket must enforce a 5MB file limit, found %', bucket_limit;
  end if;
  if not coalesce(bucket_mimes @> array[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp'
  ]::text[], false) then
    raise exception 'Seller branding MIME allow-list differs from M1 baseline';
  end if;

  select public, file_size_limit, allowed_mime_types
    into bucket_public, bucket_limit, bucket_mimes
  from storage.buckets
  where id = 'message-attachments';

  if not found then
    raise exception 'Required private message-attachments storage bucket is missing';
  end if;
  if bucket_public then
    raise exception 'Message attachments bucket must remain private';
  end if;
  if bucket_limit is distinct from 15728640 then
    raise exception 'Message attachments bucket must enforce a 15MB file limit, found %', bucket_limit;
  end if;
  if not coalesce(bucket_mimes @> array[
    'application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'
  ]::text[], false) then
    raise exception 'Message attachment MIME allow-list differs from M1 baseline';
  end if;
end
$$;

-- Transaction and private M1 table grants must agree with RLS.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'payment_sessions',
    'inventory_reservations',
    'orders',
    'order_items',
    'escrow_transactions',
    'payout_requests',
    'payout_items'
  ] loop
    if not has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT') then
      raise exception 'authenticated is missing SELECT on %', table_name;
    end if;
    if has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'DELETE') then
      raise exception 'authenticated must not directly mutate %', table_name;
    end if;
    if not has_table_privilege('service_role', format('public.%I', table_name), 'SELECT')
       or not has_table_privilege('service_role', format('public.%I', table_name), 'INSERT')
       or not has_table_privilege('service_role', format('public.%I', table_name), 'UPDATE')
       or not has_table_privilege('service_role', format('public.%I', table_name), 'DELETE') then
      raise exception 'service_role transaction privileges incomplete on %', table_name;
    end if;
  end loop;

  foreach table_name in array array[
    'kyc_documents',
    'kyc_verification_requests',
    'message_attachments'
  ] loop
    if not has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT') then
      raise exception 'authenticated is missing scoped SELECT on %', table_name;
    end if;
    if has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'DELETE') then
      raise exception 'authenticated must not directly mutate private M1 table %', table_name;
    end if;
  end loop;

  if has_table_privilege('anon', 'public.admin_audit_logs', 'SELECT')
     or has_table_privilege('authenticated', 'public.admin_audit_logs', 'SELECT') then
    raise exception 'Admin audit logs must remain trusted-worker-only';
  end if;

  if has_table_privilege('anon', 'public.payment_webhook_events', 'SELECT')
     or has_table_privilege('authenticated', 'public.payment_webhook_events', 'SELECT') then
    raise exception 'Raw payment webhook records must remain trusted-worker-only';
  end if;
  if not has_table_privilege('service_role', 'public.payment_webhook_events', 'SELECT') then
    raise exception 'service_role must inspect payment webhook deduplication records';
  end if;

  if has_table_privilege('anon', 'public.payout_provider_events', 'SELECT')
     or has_table_privilege('authenticated', 'public.payout_provider_events', 'SELECT') then
    raise exception 'Raw payout provider events must remain trusted-worker-only';
  end if;
  if not has_table_privilege('service_role', 'public.payout_provider_events', 'SELECT')
     or not has_table_privilege('service_role', 'public.payout_provider_events', 'INSERT') then
    raise exception 'service_role payout-event privileges are incomplete';
  end if;
end
$$;

-- Canonical supporting indexes introduced/required by M0, M1, and money ledgers.
do $$
declare
  idx text;
begin
  foreach idx in array array[
    'idx_addresses_user_id',
    'idx_categories_parent_id',
    'idx_featured_products_product_id',
    'idx_inventory_reservations_payment_session_id',
    'idx_inventory_reservations_product_id',
    'idx_messages_order_id',
    'idx_order_items_variant_id',
    'idx_payment_webhook_events_payment_session_id',
    'idx_product_categories_category_id',
    'idx_product_media_product_id',
    'idx_product_media_variant_id',
    'idx_product_variants_product_id',
    'idx_products_brand_id',
    'idx_reviews_buyer_id',
    'idx_payout_requests_seller_created',
    'idx_payout_requests_status',
    'idx_payout_requests_provider_reference',
    'idx_payout_items_request',
    'idx_payout_items_escrow',
    'idx_payout_items_active_escrow',
    'idx_payout_provider_events_request',
    'idx_profiles_business_verification_status',
    'idx_kyc_documents_seller_status',
    'idx_kyc_requests_seller_status',
    'idx_message_attachments_message_id'
  ] loop
    if to_regclass('public.' || idx) is null then
      raise exception 'Required supporting index missing: %', idx;
    end if;
  end loop;
end
$$;

-- Privileged RPC availability and explicit execution boundaries.
do $$
declare
  payout_fn text;
  kyc_fn text;
begin
  if has_function_privilege('anon', 'public.create_checkout_session(jsonb,jsonb,uuid)', 'EXECUTE') then
    raise exception 'anon must not execute create_checkout_session';
  end if;
  if not has_function_privilege('authenticated', 'public.create_checkout_session(jsonb,jsonb,uuid)', 'EXECUTE') then
    raise exception 'authenticated must execute create_checkout_session';
  end if;

  if has_function_privilege('anon', 'public.attach_checkout_payment_intent(uuid,text)', 'EXECUTE') then
    raise exception 'anon must not execute attach_checkout_payment_intent';
  end if;
  if not has_function_privilege('authenticated', 'public.attach_checkout_payment_intent(uuid,text)', 'EXECUTE') then
    raise exception 'authenticated must execute attach_checkout_payment_intent';
  end if;

  if has_function_privilege('anon', 'public.cancel_checkout_session(uuid)', 'EXECUTE') then
    raise exception 'anon must not execute cancel_checkout_session';
  end if;
  if not has_function_privilege('authenticated', 'public.cancel_checkout_session(uuid)', 'EXECUTE') then
    raise exception 'authenticated must execute cancel_checkout_session';
  end if;

  if has_function_privilege('anon', 'public.finalize_checkout_payment(text,text,uuid,text,boolean)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.finalize_checkout_payment(text,text,uuid,text,boolean)', 'EXECUTE') then
    raise exception 'finalize_checkout_payment must not be API-user executable';
  end if;
  if not has_function_privilege('service_role', 'public.finalize_checkout_payment(text,text,uuid,text,boolean)', 'EXECUTE') then
    raise exception 'service_role must execute finalize_checkout_payment';
  end if;

  if has_function_privilege('anon', 'public.mark_conversation_read(uuid)', 'EXECUTE') then
    raise exception 'anon must not execute mark_conversation_read';
  end if;
  if not has_function_privilege('authenticated', 'public.mark_conversation_read(uuid)', 'EXECUTE') then
    raise exception 'authenticated must execute mark_conversation_read';
  end if;

  if has_function_privilege('anon', 'public.transition_seller_order(uuid,text,text,text)', 'EXECUTE') then
    raise exception 'anon must not execute transition_seller_order';
  end if;
  if not has_function_privilege('authenticated', 'public.transition_seller_order(uuid,text,text,text)', 'EXECUTE') then
    raise exception 'authenticated must execute transition_seller_order';
  end if;

  if has_function_privilege('anon', 'public.touch_conversation_after_message()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.touch_conversation_after_message()', 'EXECUTE') then
    raise exception 'trigger helper must not be API-user executable';
  end if;

  foreach payout_fn in array array[
    'public.request_seller_payout(uuid,uuid,timestamp with time zone)',
    'public.attach_seller_payout_provider_reference(uuid,text,text)',
    'public.cancel_seller_payout_request(uuid,text)',
    'public.finalize_seller_payout_v1(text,text,text,uuid,text,text)'
  ] loop
    if has_function_privilege('anon', payout_fn, 'EXECUTE')
       or has_function_privilege('authenticated', payout_fn, 'EXECUTE') then
      raise exception 'Payout mutation RPC must be trusted-worker-only: %', payout_fn;
    end if;
    if not has_function_privilege('service_role', payout_fn, 'EXECUTE') then
      raise exception 'service_role must execute payout mutation RPC: %', payout_fn;
    end if;
  end loop;

  foreach kyc_fn in array array[
    'public.admin_review_kyc_document(uuid,uuid,text,text)',
    'public.admin_complete_seller_kyc(uuid,uuid,text,text)'
  ] loop
    if has_function_privilege('anon', kyc_fn, 'EXECUTE')
       or has_function_privilege('authenticated', kyc_fn, 'EXECUTE') then
      raise exception 'Admin KYC mutation RPC must be trusted-worker-only: %', kyc_fn;
    end if;
    if not has_function_privilege('service_role', kyc_fn, 'EXECUTE') then
      raise exception 'service_role must execute admin KYC RPC: %', kyc_fn;
    end if;
  end loop;
end
$$;

-- Search-path hardening for privileged checkout/order/payout/KYC functions.
do $$
declare
  bad_count integer;
begin
  select count(*) into bad_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'create_checkout_session',
      'attach_checkout_payment_intent',
      'cancel_checkout_session',
      'finalize_checkout_payment',
      'transition_seller_order',
      'request_seller_payout',
      'attach_seller_payout_provider_reference',
      'cancel_seller_payout_request',
      'finalize_seller_payout_v1'
    )
    and not ('search_path=pg_catalog, public' = any(coalesce(p.proconfig, array[]::text[])));

  if bad_count <> 0 then
    raise exception '% privileged money/order functions lack hardened search_path', bad_count;
  end if;

  select count(*) into bad_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('admin_review_kyc_document', 'admin_complete_seller_kyc')
    and not ('search_path=public, pg_temp' = any(coalesce(p.proconfig, array[]::text[])));

  if bad_count <> 0 then
    raise exception '% privileged KYC functions lack hardened search_path', bad_count;
  end if;
end
$$;

select 'EntizNetStore fresh database reproduction verified' as result;
