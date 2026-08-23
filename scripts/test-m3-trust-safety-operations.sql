\set ON_ERROR_STOP on

-- Combined M3 trust-and-safety regression suite.
-- Runs only against the disposable fresh CI database.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'e1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'm3-trust-buyer@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e2000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'm3-trust-seller@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e3000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'm3-trust-admin@test.invalid', '', now(), '{"role":"admin"}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e4000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'm3-trust-other@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles_buyer(id, display_name)
values
  ('e1000000-0000-0000-0000-000000000001', 'Trust Buyer'),
  ('e4000000-0000-0000-0000-000000000004', 'Other Buyer');

insert into public.profiles_seller(
  id, storefront_name, business_type, verification_status,
  return_policy, shipping_policy
) values (
  'e2000000-0000-0000-0000-000000000002',
  'Trust Seller', 'individual', 'verified',
  'Regression return policy', 'Regression shipping policy'
);

insert into public.products(
  id, seller_id, title, slug, description, type, status,
  moderation_status, base_price, requires_shipping, is_taxable,
  marketplace_brand
) values (
  'e5000000-0000-0000-0000-000000000005',
  'e2000000-0000-0000-0000-000000000002',
  'Trust Safety Product', 'trust-safety-product', 'Trust and safety regression product',
  'digital', 'draft', 'not_submitted', 20.00, false, false, 'entiznetstore'
);

insert into public.product_variants(
  id, product_id, title, sku, price, track_inventory,
  inventory_quantity, inventory_policy, requires_shipping, is_active, position
) values (
  'e6000000-0000-0000-0000-000000000006',
  'e5000000-0000-0000-0000-000000000005',
  'Default', 'TRUST-SAFE', 20.00, false, 0, 'deny', false, true, 0
);

insert into public.product_categories(product_id, category_id)
values ('e5000000-0000-0000-0000-000000000005', 'b9ec6994-3765-4a06-a072-6bcf6b619645');
insert into public.product_media(product_id, type, url, position)
values ('e5000000-0000-0000-0000-000000000005', 'image', 'https://example.invalid/trust-safety.webp', 0);

update public.products
set moderation_status = 'approved', status = 'active', moderated_at = now(), updated_at = now()
where id = 'e5000000-0000-0000-0000-000000000005';

insert into public.orders(
  id, order_number, buyer_id, seller_id, status,
  subtotal_cents, tax_cents, shipping_cents, discount_cents, total_cents,
  payment_status, fulfillment_status, created_at, updated_at
) values (
  'e7000000-0000-0000-0000-000000000007', 'TS-100001',
  'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000002',
  'delivered', 2000, 0, 0, 0, 2000, 'paid', 'fulfilled', now(), now()
);

insert into public.order_items(
  id, order_id, product_id, variant_id, quantity,
  price_cents, total_cents, product_title, variant_title,
  requires_shipping, is_digital, fulfillment_status
) values (
  'e8000000-0000-0000-0000-000000000008',
  'e7000000-0000-0000-0000-000000000007',
  'e5000000-0000-0000-0000-000000000005',
  'e6000000-0000-0000-0000-000000000006',
  1, 2000, 2000, 'Trust Safety Product', 'Default', false, true, 'fulfilled'
);

-- Browser/trusted-worker boundaries.
do $$
begin
  if has_table_privilege('authenticated', 'public.reviews', 'INSERT')
     or has_table_privilege('authenticated', 'public.reviews', 'UPDATE')
     or has_table_privilege('authenticated', 'public.marketplace_reports', 'INSERT')
     or has_table_privilege('authenticated', 'public.marketplace_reports', 'UPDATE') then
    raise exception 'Trust/safety table DML remains browser-open';
  end if;

  if has_table_privilege('authenticated', 'public.prohibited_product_rules', 'SELECT')
     or has_function_privilege('authenticated', 'public.admin_moderate_review(uuid,uuid,text,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.admin_transition_marketplace_report(uuid,uuid,text,text,text,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.admin_enforce_prohibited_product(uuid,uuid,uuid,text,text,uuid)', 'EXECUTE') then
    raise exception 'Trusted-only trust/safety controls leaked to authenticated role';
  end if;
end
$$;

-- Buyer verified-purchase review is derived from canonical delivered order/item.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select public.buyer_submit_review(
  'e7000000-0000-0000-0000-000000000007',
  'e5000000-0000-0000-0000-000000000005',
  5,
  'Excellent product',
  'Verified-purchase review body',
  false
) as review_id \gset
select set_config('m3trust.review_id', :'review_id', false);

do $$
begin
  if not exists (
    select 1 from public.reviews
    where id = current_setting('m3trust.review_id')::uuid
      and buyer_id = 'e1000000-0000-0000-0000-000000000001'
      and is_verified_purchase
      and status = 'pending'
  ) then
    raise exception 'Verified purchase review was not created pending';
  end if;

  begin
    perform public.buyer_submit_review(
      'e7000000-0000-0000-0000-000000000007',
      'e5000000-0000-0000-0000-000000000005',
      4, 'Duplicate', 'Duplicate review attempt', false
    );
    raise exception 'Duplicate order/product review was accepted';
  exception when unique_violation then null;
  end;
end
$$;
reset role;

-- A non-purchaser cannot manufacture a verified review.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e4000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"e4000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.buyer_submit_review(
      'e7000000-0000-0000-0000-000000000007',
      'e5000000-0000-0000-0000-000000000005',
      5, 'Fake', 'Should be rejected', false
    );
    raise exception 'Non-purchaser created a verified review';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- Pending review is hidden publicly but remains visible to its Buyer.
set local role anon;
do $$
begin
  if exists (select 1 from public.reviews where id = current_setting('m3trust.review_id')::uuid) then
    raise exception 'Pending review leaked publicly';
  end if;
end
$$;
reset role;

select public.admin_moderate_review(
  'e3000000-0000-0000-0000-000000000003',
  :'review_id'::uuid,
  'approved',
  'Verified purchase content approved'
);

set local role anon;
do $$
begin
  if not exists (select 1 from public.reviews where id = current_setting('m3trust.review_id')::uuid and status = 'approved') then
    raise exception 'Approved review is not publicly visible';
  end if;
end
$$;
reset role;

-- Authenticated user reports the product. Duplicate active report is blocked.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select public.submit_marketplace_report(
  'product',
  'e5000000-0000-0000-0000-000000000005',
  'prohibited_product',
  'Regression report for prohibited-product enforcement'
) as report_id \gset
select set_config('m3trust.report_id', :'report_id', false);

do $$
begin
  begin
    perform public.submit_marketplace_report(
      'product',
      'e5000000-0000-0000-0000-000000000005',
      'policy_violation',
      'Duplicate active report'
    );
    raise exception 'Duplicate active report was accepted';
  exception when unique_violation then null;
  end;
end
$$;
reset role;

select public.admin_transition_marketplace_report(
  'e3000000-0000-0000-0000-000000000003',
  :'report_id'::uuid,
  'in_review',
  'high',
  null,
  '{"queue":"trust_safety"}'::jsonb
);

-- Admin creates a canonical rule and rejects/unpublishes the product while
-- resolving the matching report. Evidence remains in product moderation + audit.
select public.admin_save_prohibited_product_rule(
  'e3000000-0000-0000-0000-000000000003',
  null,
  'm3_test_prohibited',
  'M3 regression prohibited rule',
  'Regression-only rule for trust/safety verification',
  'critical',
  'reject',
  true
) as rule_id \gset
select set_config('m3trust.rule_id', :'rule_id', false);

select public.admin_enforce_prohibited_product(
  'e3000000-0000-0000-0000-000000000003',
  'e5000000-0000-0000-0000-000000000005',
  :'rule_id'::uuid,
  'reject',
  'Product violates the regression prohibited-product rule',
  :'report_id'::uuid
);

do $$
begin
  if not exists (
    select 1 from public.products
    where id = 'e5000000-0000-0000-0000-000000000005'
      and status = 'inactive'
      and moderation_status = 'rejected'
      and moderated_by = 'e3000000-0000-0000-0000-000000000003'
  ) then
    raise exception 'Prohibited product was not taken down/rejected';
  end if;

  if not exists (
    select 1 from public.marketplace_reports
    where id = current_setting('m3trust.report_id')::uuid
      and status = 'resolved'
      and assigned_admin_id = 'e3000000-0000-0000-0000-000000000003'
      and resolution_metadata->>'enforcement_action' = 'reject'
  ) then
    raise exception 'Matching marketplace report was not resolved by enforcement';
  end if;

  if not exists (
    select 1 from public.product_moderation_events
    where product_id = 'e5000000-0000-0000-0000-000000000005'
      and action = 'rejected'
      and metadata->>'policy_rule_code' = 'm3_test_prohibited'
      and metadata->>'enforcement_action' = 'reject'
  ) then
    raise exception 'Product enforcement history was not recorded';
  end if;

  if (select count(*) from public.admin_audit_logs
      where admin_id = 'e3000000-0000-0000-0000-000000000003'
        and action in (
          'review_approved',
          'marketplace_report_taken_for_review',
          'prohibited_product_rule_created',
          'prohibited_product_enforced',
          'marketplace_report_resolved'
        )) <> 5 then
    raise exception 'Trust/safety Admin audit trail is incomplete';
  end if;

  begin
    perform public.admin_transition_marketplace_report(
      'e3000000-0000-0000-0000-000000000003',
      current_setting('m3trust.report_id')::uuid,
      'dismissed', 'normal', 'Attempt terminal rewrite', '{}'::jsonb
    );
    raise exception 'Resolved report was transitioned again';
  exception when sqlstate '22023' then null;
  end;
end
$$;

rollback;

select 'M3 trust and safety regression suite passed' as result;
