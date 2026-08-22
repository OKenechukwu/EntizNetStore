\set ON_ERROR_STOP on

-- M1 BSM verification regression.
-- Proves a Business/BSM identity shares the canonical Seller KYC decision and
-- that the final decision + business projection + audit row commit atomically.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '91000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'm1-bsm@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '92000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'm1-bsm-admin@test.invalid', '', now(), '{"role":"admin"}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles_buyer(id, display_name)
values ('91000000-0000-0000-0000-000000000001', 'M1 BSM Buyer');

insert into public.profiles_seller(id, storefront_name, business_type, verification_status)
values ('91000000-0000-0000-0000-000000000001', 'M1 BSM Store', 'business', 'under_review');

insert into public.profiles_business(id, display_name, business_kind, verification_status)
values ('91000000-0000-0000-0000-000000000001', 'M1 BSM Business', 'manufacturer', 'under_review');

insert into public.kyc_verification_requests(
  id, seller_id, verification_status, required_documents, submitted_documents
)
values (
  '93000000-0000-0000-0000-000000000003',
  '91000000-0000-0000-0000-000000000001',
  'under_review',
  array['identity','business_license','tax_document','address_proof'],
  array['identity','business_license','tax_document','address_proof']
);

insert into public.kyc_documents(
  seller_id, document_type, file_path, file_name, file_size, mime_type,
  verification_status, reviewed_at, reviewed_by
)
select
  '91000000-0000-0000-0000-000000000001'::uuid,
  document_type,
  '91000000-0000-0000-0000-000000000001/' || document_type || '/approved.pdf',
  document_type || '.pdf',
  128,
  'application/pdf',
  'approved',
  now(),
  '92000000-0000-0000-0000-000000000002'::uuid
from unnest(array['identity','business_license','tax_document','address_proof']) as document_type;

set local role service_role;
select public.admin_complete_seller_kyc(
  '92000000-0000-0000-0000-000000000002',
  '93000000-0000-0000-0000-000000000003',
  'approved',
  'Business KYC verified in M1 regression'
);
reset role;

do $$
declare
  v_seller_status text;
  v_business_status text;
  v_request_status text;
  v_audit_count integer;
  v_business_synced boolean;
begin
  select verification_status into v_seller_status
  from public.profiles_seller
  where id = '91000000-0000-0000-0000-000000000001';

  select verification_status into v_business_status
  from public.profiles_business
  where id = '91000000-0000-0000-0000-000000000001';

  select verification_status into v_request_status
  from public.kyc_verification_requests
  where id = '93000000-0000-0000-0000-000000000003';

  select count(*), bool_or(coalesce((metadata->>'business_status_synced')::boolean, false))
    into v_audit_count, v_business_synced
  from public.admin_audit_logs
  where admin_id = '92000000-0000-0000-0000-000000000002'
    and action = 'verification_complete'
    and target_id = '93000000-0000-0000-0000-000000000003';

  if v_seller_status <> 'verified' then
    raise exception 'BSM Seller verification did not become verified: %', v_seller_status;
  end if;
  if v_business_status <> 'verified' then
    raise exception 'Business projection did not synchronize verification: %', v_business_status;
  end if;
  if v_request_status <> 'approved' then
    raise exception 'BSM KYC request did not become approved: %', v_request_status;
  end if;
  if v_audit_count <> 1 or not coalesce(v_business_synced, false) then
    raise exception 'BSM verification audit evidence incomplete: rows %, synced %', v_audit_count, v_business_synced;
  end if;
end
$$;

rollback;

select 'EntizNetStore M1 BSM verification regression passed' as result;
