\set ON_ERROR_STOP on

-- EntizNetStore M0 fresh-environment reproduction assertions.
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

  if v_public_tables <> 27 then
    raise exception 'Expected 27 public tables, found %', v_public_tables;
  end if;

  select count(*) into v_rls_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity;

  if v_rls_tables <> 27 then
    raise exception 'Expected RLS on all 27 public tables, found %', v_rls_tables;
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

  if v_no_policy_tables <> 11 then
    raise exception 'Expected 11 intentional deny-by-default RLS tables, found %', v_no_policy_tables;
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
    ('payment_sessions'), ('payment_webhook_events'), ('product_categories'),
    ('product_media'), ('product_variants'), ('products'), ('profiles_buyer'),
    ('profiles_seller'), ('profiles_seller_private'), ('reviews')
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
    raise exception 'Public table set differs from canonical M0 baseline';
  end if;
end
$$;

-- Private KYC storage must be reproduced exactly enough to remain non-public,
-- size-limited and restricted to the launch-approved document formats.
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
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ]::text[], false) then
    raise exception 'KYC storage bucket MIME allow-list differs from M0 baseline';
  end if;
end
$$;

-- Canonical supporting indexes introduced/required by M0.
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
    'idx_reviews_buyer_id'
  ] loop
    if to_regclass('public.' || idx) is null then
      raise exception 'Required supporting index missing: %', idx;
    end if;
  end loop;
end
$$;

-- Privileged RPC availability and explicit execution boundaries.
do $$
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
end
$$;

-- Search-path hardening for privileged checkout/order functions.
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
      'transition_seller_order'
    )
    and not ('search_path=pg_catalog, public' = any(coalesce(p.proconfig, array[]::text[])));

  if bad_count <> 0 then
    raise exception '% privileged checkout/order functions lack hardened search_path', bad_count;
  end if;
end
$$;

select 'EntizNetStore fresh database reproduction verified' as result;
