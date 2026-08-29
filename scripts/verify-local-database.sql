\set ON_ERROR_STOP on

-- EntizNetStore canonical fresh-environment assertions.
-- Replayed after every repository migration + seed on a clean Supabase stack.

-- ---------------------------------------------------------------------------
-- Exact public schema, RLS and seed baseline
-- ---------------------------------------------------------------------------
do $$
declare
  v_public_tables integer;
  v_rls_tables integer;
  v_no_policy_tables integer;
  v_categories integer;
  v_brands integer;
begin
  select count(*) into v_public_tables
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r';
  if v_public_tables <> 49 then
    raise exception 'Expected 49 public tables, found %', v_public_tables;
  end if;

  select count(*) into v_rls_tables
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity;
  if v_rls_tables <> 49 then
    raise exception 'Expected RLS on all 49 public tables, found %', v_rls_tables;
  end if;

  select count(*) into v_no_policy_tables
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relrowsecurity
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid);
  -- Reviews, content pages and notifications have scoped policies while
  -- prohibited-product rules and the upload scan ledger remain trusted-worker-only.
  -- Ten operational tables intentionally remain deny-by-default.
  if v_no_policy_tables <> 10 then
    raise exception 'Expected 10 intentional deny-by-default RLS tables, found %', v_no_policy_tables;
  end if;

  select count(*) into v_categories from public.categories;
  select count(*) into v_brands from public.brands;
  if v_categories <> 16 then raise exception 'Expected 16 seeded categories, found %', v_categories; end if;
  if v_brands <> 6 then raise exception 'Expected 6 seeded brands, found %', v_brands; end if;
end
$$;

with expected(name) as (
  values
    ('addresses'), ('admin_audit_logs'), ('brands'), ('business_trading_roles'),
    ('cart_items'), ('cart_quotes'), ('carts'), ('categories'), ('content_pages'),
    ('conversation_keys'), ('conversations'), ('entiznet_handoff_events'),
    ('entiznet_identity_links'), ('escrow_transactions'), ('featured_products'),
    ('inventory_reservations'), ('kyc_documents'), ('kyc_verification_requests'),
    ('marketplace_capability_state_events'), ('marketplace_capability_states'),
    ('marketplace_reports'), ('message_attachments'), ('messages'), ('notifications'),
    ('order_dispute_events'), ('order_disputes'), ('order_items'), ('orders'),
    ('payment_sessions'), ('payment_webhook_events'), ('payout_items'),
    ('payout_provider_events'), ('payout_requests'), ('product_categories'),
    ('product_media'), ('product_moderation_events'), ('product_variants'),
    ('products'), ('profiles_business'), ('profiles_buyer'), ('profiles_seller'),
    ('profiles_seller_private'), ('prohibited_product_rules'),
    ('refund_provider_events'), ('refund_requests'), ('reviews'), ('upload_scan_jobs'),
    ('wholesale_offer_tiers'), ('wholesale_offers')
), actual(name) as (
  select c.relname::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
), delta as (
  (select name from expected except select name from actual)
  union all
  (select name from actual except select name from expected)
)
select case when exists (select 1 from delta)
  then pg_catalog.set_config('entiznetstore.invalid_table_delta', 'true', false)
  else pg_catalog.set_config('entiznetstore.invalid_table_delta', 'false', false)
end;

do $$
begin
  if current_setting('entiznetstore.invalid_table_delta', true) = 'true' then
    raise exception 'Public table set differs from canonical 49-table M4A marketplace baseline';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kyc_documents'
      and column_name = 'upload_scan_job_id'
      and data_type = 'uuid'
  ) then
    raise exception 'KYC documents lost upload_scan_job_id evidence link';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Storage contracts
-- ---------------------------------------------------------------------------
do $$
declare
  v_public boolean;
  v_limit bigint;
  v_mimes text[];
begin
  select public, file_size_limit, allowed_mime_types into v_public, v_limit, v_mimes
  from storage.buckets where id = 'kyc-documents';
  if not found or v_public or v_limit is distinct from 10485760
     or not coalesce(v_mimes @> array['application/pdf','image/jpeg','image/jpg','image/png','image/webp']::text[], false) then
    raise exception 'KYC storage bucket contract differs from baseline';
  end if;

  select public, file_size_limit, allowed_mime_types into v_public, v_limit, v_mimes
  from storage.buckets where id = 'product-media';
  if not found or not v_public or v_limit is distinct from 10485760
     or not coalesce(v_mimes @> array['image/jpeg','image/jpg','image/png','image/webp']::text[], false) then
    raise exception 'Product media bucket contract differs from baseline';
  end if;

  select public, file_size_limit, allowed_mime_types into v_public, v_limit, v_mimes
  from storage.buckets where id = 'seller-branding';
  if not found or not v_public or v_limit is distinct from 5242880
     or not coalesce(v_mimes @> array['image/jpeg','image/jpg','image/png','image/webp']::text[], false) then
    raise exception 'Seller branding bucket contract differs from baseline';
  end if;

  select public, file_size_limit, allowed_mime_types into v_public, v_limit, v_mimes
  from storage.buckets where id = 'message-attachments';
  if not found or v_public or v_limit is distinct from 15728640
     or not coalesce(v_mimes @> array['application/pdf','image/jpeg','image/jpg','image/png','image/webp']::text[], false) then
    raise exception 'Message attachment bucket contract differs from baseline';
  end if;

  select public, file_size_limit, allowed_mime_types into v_public, v_limit, v_mimes
  from storage.buckets where id = 'upload-quarantine';
  if not found or v_public or v_limit is distinct from 15728640
     or not coalesce(v_mimes @> array['application/pdf','image/jpeg','image/jpg','image/png','image/webp']::text[], false) then
    raise exception 'Upload quarantine bucket contract differs from baseline';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Browser/trusted-worker table privilege contracts
-- ---------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'payment_sessions','inventory_reservations','orders','order_items',
    'escrow_transactions','payout_requests','payout_items',
    'order_disputes','order_dispute_events','refund_requests'
  ] loop
    if not has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT') then
      raise exception 'authenticated missing scoped SELECT on %', v_table;
    end if;
    if has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'DELETE') then
      raise exception 'authenticated must not directly mutate %', v_table;
    end if;
    if not has_table_privilege('service_role', format('public.%I', v_table), 'SELECT')
       or not has_table_privilege('service_role', format('public.%I', v_table), 'INSERT')
       or not has_table_privilege('service_role', format('public.%I', v_table), 'UPDATE')
       or not has_table_privilege('service_role', format('public.%I', v_table), 'DELETE') then
      raise exception 'service_role transaction privileges incomplete on %', v_table;
    end if;
  end loop;

  foreach v_table in array array[
    'kyc_documents','kyc_verification_requests','message_attachments',
    'product_moderation_events','addresses','carts','cart_items','cart_quotes',
    'marketplace_capability_states','entiznet_identity_links','marketplace_reports',
    'content_pages','notifications','business_trading_roles','wholesale_offers',
    'wholesale_offer_tiers'
  ] loop
    if not has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT') then
      raise exception 'authenticated missing scoped SELECT on %', v_table;
    end if;
    if has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'DELETE') then
      raise exception 'authenticated must not directly mutate scoped table %', v_table;
    end if;
  end loop;

  foreach v_table in array array[
    'products','product_variants','product_media','product_categories','categories','brands','reviews'
  ] loop
    if not has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT') then
      raise exception 'authenticated missing catalogue/trust SELECT on %', v_table;
    end if;
    if has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'DELETE') then
      raise exception 'Catalogue/trust table must remain RPC-mutation-only: %', v_table;
    end if;
  end loop;

  if not has_table_privilege('anon','public.content_pages','SELECT') then
    raise exception 'anon must be able to read RLS-scoped active content pages';
  end if;
  if has_table_privilege('anon','public.notifications','SELECT') then
    raise exception 'anon must not read notifications';
  end if;

  foreach v_table in array array[
    'admin_audit_logs','payment_webhook_events','payout_provider_events',
    'marketplace_capability_state_events','entiznet_handoff_events','refund_provider_events',
    'prohibited_product_rules','upload_scan_jobs'
  ] loop
    if has_table_privilege('anon', format('public.%I', v_table), 'SELECT')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT') then
      raise exception 'Trusted operational table leaked to browser roles: %', v_table;
    end if;
    if not has_table_privilege('service_role', format('public.%I', v_table), 'SELECT') then
      raise exception 'service_role missing operational table access: %', v_table;
    end if;
  end loop;

  if not has_table_privilege('service_role','public.upload_scan_jobs','INSERT')
     or not has_table_privilege('service_role','public.upload_scan_jobs','UPDATE')
     or not has_table_privilege('service_role','public.upload_scan_jobs','DELETE') then
    raise exception 'service_role upload scan ledger mutation privileges are incomplete';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Supporting index contracts
-- ---------------------------------------------------------------------------
do $$
declare
  v_idx text;
begin
  foreach v_idx in array array[
    'idx_addresses_user_id','addresses_one_default_per_user_type','idx_addresses_user_created',
    'carts_one_active_per_buyer','idx_carts_buyer_updated','cart_items_cart_variant_mode_key',
    'idx_cart_items_cart','idx_cart_items_variant','idx_cart_items_product_id','idx_cart_quotes_cart_created',
    'idx_cart_quotes_buyer_created','idx_cart_quotes_expiry',
    'idx_categories_parent_id','idx_categories_active_parent_sort','idx_brands_active_name',
    'idx_content_pages_brand_active_key','idx_notifications_user_unread_created',
    'idx_featured_products_product_id',
    'idx_inventory_reservations_payment_session_id','idx_inventory_reservations_product_id',
    'idx_messages_order_id','idx_order_items_variant_id',
    'idx_payment_webhook_events_payment_session_id','idx_product_categories_category_id',
    'idx_product_media_product_id','idx_product_media_variant_id','idx_product_variants_product_id',
    'idx_products_brand_id','idx_products_moderation_status','idx_product_moderation_events_product_created',
    'profiles_seller_store_slug_key','idx_reviews_buyer_id','reviews_one_per_order_product_buyer',
    'idx_reviews_status_created','idx_reviews_product_status_created','idx_reviews_order_id','idx_reviews_moderated_by',
    'idx_payout_requests_seller_created','idx_payout_requests_status','idx_payout_requests_provider_reference',
    'idx_payout_items_request','idx_payout_items_escrow','idx_payout_items_active_escrow',
    'idx_payout_provider_events_request','idx_profiles_business_verification_status',
    'idx_kyc_documents_seller_status','idx_kyc_requests_seller_status','idx_message_attachments_message_id',
    'idx_marketplace_capability_states_status','idx_marketplace_capability_states_suspended_by','idx_marketplace_capability_states_restored_by',
    'idx_marketplace_capability_state_events_user_created','idx_marketplace_capability_state_events_capability_created',
    'idx_marketplace_capability_state_events_actor_id',
    'idx_entiznet_identity_links_status','idx_entiznet_handoff_events_entiznet_created',
    'idx_entiznet_handoff_events_store_created','idx_entiznet_handoff_events_status_expiry',
    'order_disputes_one_nonclosed_per_order','idx_order_disputes_status_created',
    'idx_order_disputes_order_created','idx_order_disputes_raised_by_created','idx_order_disputes_assigned_admin_id',
    'idx_order_dispute_events_dispute_created','idx_order_dispute_events_actor_id','refund_requests_one_active_per_order',
    'idx_refund_requests_provider_reference','idx_refund_requests_status_created',
    'idx_refund_requests_order_created','idx_refund_requests_buyer_created','idx_refund_requests_dispute_id',
    'idx_refund_requests_requested_by','idx_refund_requests_reviewed_by',
    'idx_refund_provider_events_request','idx_escrow_transactions_dispute_id',
    'marketplace_reports_one_active_per_reporter_subject','idx_marketplace_reports_status_priority_created',
    'idx_marketplace_reports_subject_created','idx_marketplace_reports_reporter_created',
    'idx_marketplace_reports_assigned_admin','idx_prohibited_product_rules_active_severity',
    'idx_prohibited_product_rules_created_by','idx_prohibited_product_rules_updated_by',
    'idx_upload_scan_jobs_actor_created','idx_upload_scan_jobs_status_created',
    'idx_upload_scan_jobs_purpose_created','idx_kyc_documents_upload_scan_job_id',
    'business_trading_roles_one_primary','idx_wholesale_offers_active_variant',
    'idx_wholesale_offers_seller_status','idx_wholesale_offer_tiers_lookup',
    'idx_cart_items_wholesale_offer'
  ] loop
    if to_regclass('public.' || v_idx) is null then
      raise exception 'Required supporting index missing: %', v_idx;
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- RPC execution boundaries
-- ---------------------------------------------------------------------------
do $$
declare
  v_fn text;
begin
  if has_function_privilege('anon','public.create_checkout_session(jsonb,jsonb,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.create_checkout_session(jsonb,jsonb,uuid)','EXECUTE') then
    raise exception 'Legacy create_checkout_session must be trusted-worker-only';
  end if;
  if not has_function_privilege('service_role','public.create_checkout_session(jsonb,jsonb,uuid)','EXECUTE') then
    raise exception 'service_role must retain legacy checkout compatibility execution';
  end if;
  if has_function_privilege('anon','public.create_checkout_session_v2(uuid,uuid,uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.create_checkout_session_v2(uuid,uuid,uuid)','EXECUTE') then
    raise exception 'M3 create_checkout_session_v2 execution boundary is incorrect';
  end if;

  if has_function_privilege('anon','public.attach_checkout_payment_intent(uuid,text)','EXECUTE')
     or has_function_privilege('authenticated','public.attach_checkout_payment_intent(uuid,text)','EXECUTE')
     or not has_function_privilege('service_role','public.attach_checkout_payment_intent(uuid,text)','EXECUTE') then
    raise exception 'Legacy payment-intent wrapper must be trusted-worker-only';
  end if;

  foreach v_fn in array array[
    'public.cancel_checkout_session(uuid)',
    'public.mark_conversation_read(uuid)',
    'public.transition_seller_order(uuid,text,text,text)',
    'public.open_order_dispute(uuid,text,text)',
    'public.buyer_request_order_refund(uuid,bigint,text,uuid)',
    'public.buyer_submit_review(uuid,uuid,integer,text,text,boolean)',
    'public.submit_marketplace_report(text,uuid,text,text)',
    'public.mark_notification_read(uuid)',
    'public.mark_all_notifications_read()'
  ] loop
    if has_function_privilege('anon', v_fn, 'EXECUTE')
       or not has_function_privilege('authenticated', v_fn, 'EXECUTE') then
      raise exception 'Authenticated RPC boundary is incorrect: %', v_fn;
    end if;
  end loop;

  foreach v_fn in array array[
    'public.finalize_checkout_payment(text,text,uuid,text,boolean)',
    'public.finalize_checkout_payment_v2(text,text,uuid,text,text,text)',
    'public.request_seller_payout(uuid,uuid,timestamp with time zone)',
    'public.attach_seller_payout_provider_reference(uuid,text,text)',
    'public.cancel_seller_payout_request(uuid,text)',
    'public.finalize_seller_payout_v1(text,text,text,uuid,text,text)',
    'public.admin_review_kyc_document(uuid,uuid,text,text)',
    'public.admin_complete_seller_kyc(uuid,uuid,text,text)',
    'public.admin_review_product(uuid,uuid,text,text)',
    'public.admin_set_marketplace_capability_state(uuid,uuid,text,text,text)',
    'public.upsert_entiznet_identity_link(uuid,uuid,text[],text,text,jsonb)',
    'public.revoke_entiznet_identity_link(uuid,text)',
    'public.register_entiznet_handoff(text,uuid,text,text,text,text[],timestamp with time zone,timestamp with time zone,jsonb)',
    'public.complete_entiznet_handoff(uuid,uuid,text,text)',
    'public.admin_search_marketplace_accounts(uuid,text,text,text,integer,integer)',
    'public.admin_get_marketplace_account(uuid,uuid)',
    'public.admin_transition_order_dispute(uuid,uuid,text,text)',
    'public.admin_review_refund_request(uuid,uuid,text,text)',
    'public.attach_refund_provider_reference(uuid,text,text)',
    'public.finalize_refund_v1(text,text,uuid,text,text,text,text,text)',
    'public.admin_search_order_disputes(uuid,text,text,text,integer,integer)',
    'public.admin_search_refund_requests(uuid,text,text,integer,integer)',
    'public.admin_save_category(uuid,uuid,text,text,text,uuid,boolean,boolean,integer)',
    'public.admin_delete_category(uuid,uuid)',
    'public.admin_save_brand(uuid,uuid,text,text,text,text,text,text,boolean,boolean)',
    'public.admin_delete_brand(uuid,uuid)',
    'public.admin_moderate_review(uuid,uuid,text,text)',
    'public.admin_transition_marketplace_report(uuid,uuid,text,text,text,jsonb)',
    'public.admin_save_prohibited_product_rule(uuid,uuid,text,text,text,text,text,boolean)',
    'public.admin_enforce_prohibited_product(uuid,uuid,uuid,text,text,uuid)',
    'public.admin_save_content_page(uuid,uuid,text,text,text,jsonb,boolean)',
    'public.admin_send_notification(uuid,uuid,text,text,text,text,jsonb)'
  ] loop
    if has_function_privilege('anon', v_fn, 'EXECUTE')
       or has_function_privilege('authenticated', v_fn, 'EXECUTE')
       or not has_function_privilege('service_role', v_fn, 'EXECUTE') then
      raise exception 'Trusted-worker-only RPC boundary is incorrect: %', v_fn;
    end if;
  end loop;

  foreach v_fn in array array[
    'public.guard_seller_capability_for_product_mutation()',
    'public.guard_buyer_capability_for_cart_mutation()',
    'public.guard_capabilities_for_cart_item_mutation()',
    'public.guard_buyer_capability_for_checkout_insert()',
    'public.guard_active_product_category()',
    'public.guard_active_product_brand()',
    'public.touch_conversation_after_message()',
    'public.guard_wholesale_offer_integrity()',
    'public.guard_wholesale_cart_item_integrity()'
  ] loop
    if has_function_privilege('anon', v_fn, 'EXECUTE')
       or has_function_privilege('authenticated', v_fn, 'EXECUTE') then
      raise exception 'Trigger helper leaked browser execution: %', v_fn;
    end if;
  end loop;

  if has_function_privilege('anon','public.marketplace_capability_is_active(uuid,text)','EXECUTE')
     or has_function_privilege('authenticated','public.marketplace_capability_is_active(uuid,text)','EXECUTE')
     or not has_function_privilege('service_role','public.marketplace_capability_is_active(uuid,text)','EXECUTE') then
    raise exception 'Public capability helper browser execution boundary is incorrect';
  end if;

  if to_regprocedure('app_private.marketplace_capability_is_active(uuid,text)') is null
     or not has_schema_privilege('anon','app_private','USAGE')
     or not has_schema_privilege('authenticated','app_private','USAGE')
     or not has_function_privilege('anon','app_private.marketplace_capability_is_active(uuid,text)','EXECUTE')
     or not has_function_privilege('authenticated','app_private.marketplace_capability_is_active(uuid,text)','EXECUTE') then
    raise exception 'Private capability RLS helper boundary is incorrect';
  end if;

  if has_function_privilege('authenticated','public.seller_save_product(uuid,text,text,numeric,numeric,text,uuid[],text[],integer)','EXECUTE')
     or has_function_privilege('authenticated','public.seller_save_product_v2(uuid,text,text,numeric,numeric,text,uuid[],text[],jsonb)','EXECUTE') then
    raise exception 'Legacy Seller save RPC remains authenticated-executable';
  end if;

  foreach v_fn in array array[
    'public.seller_save_product_v3(uuid,text,text,text,text,numeric,numeric,numeric,uuid,uuid[],text[],jsonb,boolean,boolean,boolean,boolean,integer,text,integer,text[],text[])',
    'public.seller_submit_product_for_review(uuid)',
    'public.seller_set_product_publication(uuid,boolean)',
    'public.seller_delete_product(uuid)',
    'public.buyer_save_address(uuid,text,boolean,text,text,text,text,text,text,text,text,text,text,text)',
    'public.buyer_delete_address(uuid)',
    'public.buyer_get_or_create_cart()',
    'public.buyer_set_cart_item(uuid,uuid,integer)',
    'public.buyer_remove_cart_item(uuid)',
    'public.buyer_clear_cart()',
    'public.business_set_trading_roles(text[])',
    'public.business_save_wholesale_offer(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamp with time zone,timestamp with time zone,jsonb)',
    'public.buyer_set_wholesale_cart_item(uuid,integer)'
  ] loop
    if has_function_privilege('anon', v_fn, 'EXECUTE')
       or not has_function_privilege('authenticated', v_fn, 'EXECUTE') then
      raise exception 'Authenticated owner-scoped RPC boundary is incorrect: %', v_fn;
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER search-path hardening
-- ---------------------------------------------------------------------------
do $$
declare
  v_bad integer;
begin
  select count(*) into v_bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'create_checkout_session','create_checkout_session_v2',
      'attach_checkout_payment_intent','attach_checkout_payment_reference',
      'cancel_checkout_session','finalize_checkout_payment','finalize_checkout_payment_v2',
      'transition_seller_order','request_seller_payout','attach_seller_payout_provider_reference',
      'cancel_seller_payout_request','finalize_seller_payout_v1',
      'seller_save_product_v3','seller_submit_product_for_review',
      'seller_set_product_publication','seller_delete_product',
      'buyer_save_address','buyer_delete_address','buyer_get_or_create_cart',
      'buyer_set_cart_item','buyer_remove_cart_item','buyer_clear_cart',
      'buyer_submit_review','submit_marketplace_report','mark_notification_read','mark_all_notifications_read',
      'marketplace_capability_is_active','upsert_entiznet_identity_link',
      'revoke_entiznet_identity_link','register_entiznet_handoff','complete_entiznet_handoff',
      'guard_seller_capability_for_product_mutation','guard_buyer_capability_for_cart_mutation',
      'guard_capabilities_for_cart_item_mutation','guard_buyer_capability_for_checkout_insert',
      'guard_active_product_category','guard_active_product_brand',
      'open_order_dispute','buyer_request_order_refund','attach_refund_provider_reference','finalize_refund_v1',
      'business_set_trading_roles','business_save_wholesale_offer','buyer_set_wholesale_cart_item',
      'guard_wholesale_offer_integrity','guard_wholesale_cart_item_integrity'
    )
    and not (
      'search_path=pg_catalog, public' = any(coalesce(p.proconfig, array[]::text[]))
      or 'search_path=pg_catalog, public, app_private' = any(coalesce(p.proconfig, array[]::text[]))
    );
  if v_bad <> 0 then
    raise exception '% privileged marketplace/integration functions lack an approved hardened search_path', v_bad;
  end if;

  select count(*) into v_bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app_private'
    and p.proname = 'marketplace_capability_is_active'
    and not ('search_path=pg_catalog, public' = any(coalesce(p.proconfig, array[]::text[])));
  if v_bad <> 0 then
    raise exception 'Private capability helper lacks hardened pg_catalog,public search_path';
  end if;

  select count(*) into v_bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('admin_review_kyc_document','admin_complete_seller_kyc')
    and not ('search_path=public, pg_temp' = any(coalesce(p.proconfig, array[]::text[])));
  if v_bad <> 0 then raise exception '% privileged KYC functions lack hardened search_path', v_bad; end if;

  select count(*) into v_bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'admin_review_product','admin_set_marketplace_capability_state',
      'admin_search_marketplace_accounts','admin_get_marketplace_account',
      'admin_transition_order_dispute','admin_review_refund_request',
      'admin_search_order_disputes','admin_search_refund_requests','admin_get_marketplace_order',
      'admin_save_category','admin_delete_category','admin_save_brand','admin_delete_brand',
      'admin_moderate_review','admin_transition_marketplace_report',
      'admin_save_prohibited_product_rule','admin_enforce_prohibited_product',
      'admin_save_content_page','admin_send_notification'
    )
    and not ('search_path=pg_catalog, public, auth' = any(coalesce(p.proconfig, array[]::text[])));
  if v_bad <> 0 then raise exception '% privileged Admin operations lack hardened search_path', v_bad; end if;
end
$$;

select 'EntizNetStore fresh database reproduction verified' as result;