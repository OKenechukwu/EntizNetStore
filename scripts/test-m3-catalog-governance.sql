\set ON_ERROR_STOP on

-- Combined M3 catalogue-governance regression suite.
-- Runs only against the disposable fresh CI database.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'd1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'm3-catalog-admin@test.invalid', '', now(), '{"role":"admin"}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd2000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'm3-catalog-seller@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles_seller(
  id, storefront_name, business_type, verification_status,
  return_policy, shipping_policy
) values (
  'd2000000-0000-0000-0000-000000000002',
  'M3 Catalogue Seller', 'individual', 'verified',
  'Regression return policy', 'Regression shipping policy'
);

-- Future categories must default to general rather than silently inheriting the
-- legacy adult classification used by the existing production taxonomy.
insert into public.categories(name, slug)
values ('M3 Default General', 'm3-default-general')
returning id as default_category_id \gset

do $$
begin
  if (select is_adult from public.categories where id = current_setting('m3.default_category_id', true)::uuid) is distinct from false then
    raise exception 'New category did not default to non-adult classification';
  end if;
exception when invalid_text_representation then
  -- psql variables are persisted explicitly below when needed; this block is
  -- replaced by the direct assertion after set_config.
  null;
end
$$;
select set_config('m3.default_category_id', :'default_category_id', false);
do $$
begin
  if (select is_adult from public.categories where id = current_setting('m3.default_category_id')::uuid) is distinct from false then
    raise exception 'New category did not default to non-adult classification';
  end if;
end
$$;
delete from public.categories where id = :'default_category_id'::uuid;

-- Trusted execution boundaries.
do $$
begin
  if has_table_privilege('authenticated', 'public.categories', 'INSERT')
     or has_table_privilege('authenticated', 'public.categories', 'UPDATE')
     or has_table_privilege('authenticated', 'public.categories', 'DELETE')
     or has_table_privilege('authenticated', 'public.brands', 'INSERT')
     or has_table_privilege('authenticated', 'public.brands', 'UPDATE')
     or has_table_privilege('authenticated', 'public.brands', 'DELETE') then
    raise exception 'Browser catalogue-governance DML remains open';
  end if;

  if has_function_privilege('authenticated', 'public.admin_save_category(uuid,uuid,text,text,text,uuid,boolean,boolean,integer)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.admin_save_category(uuid,uuid,text,text,text,uuid,boolean,boolean,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.admin_save_brand(uuid,uuid,text,text,text,text,text,text,boolean,boolean)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.admin_save_brand(uuid,uuid,text,text,text,text,text,text,boolean,boolean)', 'EXECUTE') then
    raise exception 'Catalogue-governance RPC execution boundary is incorrect';
  end if;
end
$$;

-- Parent/child category lifecycle.
select public.admin_save_category(
  'd1000000-0000-0000-0000-000000000001', null,
  'M3 General Parent', 'm3-general-parent', 'General regression category',
  null, false, true, 100
) as parent_category_id \gset
select set_config('m3.parent_category_id', :'parent_category_id', false);

select public.admin_save_category(
  'd1000000-0000-0000-0000-000000000001', null,
  'M3 General Child', 'm3-general-child', null,
  :'parent_category_id'::uuid, false, true, 101
) as child_category_id \gset
select set_config('m3.child_category_id', :'child_category_id', false);

do $$
begin
  begin
    perform public.admin_save_category(
      'd1000000-0000-0000-0000-000000000001',
      current_setting('m3.parent_category_id')::uuid,
      'M3 General Parent', 'm3-general-parent', 'General regression category',
      current_setting('m3.child_category_id')::uuid,
      false, true, 100
    );
    raise exception 'Category hierarchy cycle was accepted';
  exception when sqlstate '22023' then null;
  end;

  begin
    perform public.admin_save_category(
      'd1000000-0000-0000-0000-000000000001',
      current_setting('m3.parent_category_id')::uuid,
      'M3 General Parent', 'm3-general-parent', 'General regression category',
      null, false, false, 100
    );
    raise exception 'Parent category deactivated while an active child remained';
  exception when sqlstate '22023' then null;
  end;
end
$$;

select public.admin_save_category(
  'd1000000-0000-0000-0000-000000000001', :'child_category_id'::uuid,
  'M3 General Child', 'm3-general-child', null,
  :'parent_category_id'::uuid, false, false, 101
);
select public.admin_save_category(
  'd1000000-0000-0000-0000-000000000001', :'parent_category_id'::uuid,
  'M3 General Parent', 'm3-general-parent', 'General regression category',
  null, false, false, 100
);

-- Inactive taxonomy cannot be attached to Seller products.
insert into public.products(
  id, seller_id, title, slug, description, type, status,
  moderation_status, base_price, requires_shipping, is_taxable,
  marketplace_brand
) values (
  'd3000000-0000-0000-0000-000000000003',
  'd2000000-0000-0000-0000-000000000002',
  'M3 Catalogue Governance Product', 'm3-catalogue-governance-product',
  'Regression product', 'digital', 'draft', 'not_submitted', 25.00,
  false, false, 'entiznetstore'
);

do $$
begin
  begin
    insert into public.product_categories(product_id, category_id)
    values (
      'd3000000-0000-0000-0000-000000000003',
      current_setting('m3.child_category_id')::uuid
    );
    raise exception 'Inactive category was attached to a product';
  exception when sqlstate '22023' then null;
  end;
end
$$;

-- Reactivate hierarchy, attach product, then prove deletion remains safe even
-- after taxonomy is later retired.
select public.admin_save_category(
  'd1000000-0000-0000-0000-000000000001', :'parent_category_id'::uuid,
  'M3 General Parent', 'm3-general-parent', 'General regression category',
  null, false, true, 100
);
select public.admin_save_category(
  'd1000000-0000-0000-0000-000000000001', :'child_category_id'::uuid,
  'M3 General Child', 'm3-general-child', null,
  :'parent_category_id'::uuid, false, true, 101
);
insert into public.product_categories(product_id, category_id)
values ('d3000000-0000-0000-0000-000000000003', :'child_category_id'::uuid);

select public.admin_save_category(
  'd1000000-0000-0000-0000-000000000001', :'child_category_id'::uuid,
  'M3 General Child', 'm3-general-child', null,
  :'parent_category_id'::uuid, false, false, 101
);

do $$
begin
  begin
    perform public.admin_delete_category(
      'd1000000-0000-0000-0000-000000000001',
      current_setting('m3.child_category_id')::uuid
    );
    raise exception 'Referenced category was deleted';
  exception when foreign_key_violation then null;
  end;
end
$$;

-- Brand retirement blocks Seller attachment while retaining historical refs.
select public.admin_save_brand(
  'd1000000-0000-0000-0000-000000000001', null,
  'M3 Active Brand', 'm3-active-brand', 'Regression brand',
  null, null, 'https://example.invalid', true, true
) as brand_id \gset
select set_config('m3.brand_id', :'brand_id', false);

update public.products
set brand_id = :'brand_id'::uuid
where id = 'd3000000-0000-0000-0000-000000000003';

select public.admin_save_brand(
  'd1000000-0000-0000-0000-000000000001', :'brand_id'::uuid,
  'M3 Active Brand', 'm3-active-brand', 'Regression brand',
  null, null, 'https://example.invalid', true, false
);

select public.admin_save_brand(
  'd1000000-0000-0000-0000-000000000001', null,
  'M3 Retired Brand', 'm3-retired-brand', null,
  null, null, null, false, false
) as retired_brand_id \gset
select set_config('m3.retired_brand_id', :'retired_brand_id', false);

do $$
begin
  begin
    update public.products
    set brand_id = current_setting('m3.retired_brand_id')::uuid
    where id = 'd3000000-0000-0000-0000-000000000003';
    raise exception 'Inactive brand was attached to a product';
  exception when sqlstate '22023' then null;
  end;

  begin
    perform public.admin_delete_brand(
      'd1000000-0000-0000-0000-000000000001',
      current_setting('m3.brand_id')::uuid
    );
    raise exception 'Referenced brand was deleted';
  exception when foreign_key_violation then null;
  end;
end
$$;

select public.admin_delete_brand(
  'd1000000-0000-0000-0000-000000000001', :'retired_brand_id'::uuid
);

-- Every high-risk taxonomy mutation is attributable.
do $$
begin
  if (select count(*) from public.admin_audit_logs
      where admin_id = 'd1000000-0000-0000-0000-000000000001'
        and action in (
          'catalog_category_created', 'catalog_category_updated',
          'catalog_brand_created', 'catalog_brand_updated', 'catalog_brand_deleted'
        )) < 8 then
    raise exception 'Catalogue-governance Admin audit coverage is incomplete';
  end if;
end
$$;

rollback;

select 'M3 catalogue governance regression suite passed' as result;
