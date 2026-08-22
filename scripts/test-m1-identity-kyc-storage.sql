\set ON_ERROR_STOP on

-- M1 identity/KYC/storage authorization regression suite.
-- Runs only against the disposable local Supabase database created by CI.
-- All fixture data is rolled back.

begin;

-- ---------------------------------------------------------------------------
-- Fixture identities: one multi-capability account, one separate seller, admin.
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'm1-multi@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '82000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'm1-other@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '83000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'm1-admin@test.invalid', '', now(), '{"role":"admin"}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles_buyer(id, display_name)
values
  ('81000000-0000-0000-0000-000000000001', 'M1 Multi Capability'),
  ('82000000-0000-0000-0000-000000000002', 'M1 Other Seller');

insert into public.profiles_seller(id, storefront_name, business_type, verification_status)
values
  ('81000000-0000-0000-0000-000000000001', 'M1 Multi Store', 'individual', 'pending'),
  ('82000000-0000-0000-0000-000000000002', 'M1 Other Store', 'individual', 'pending');

insert into public.profiles_business(id, display_name, business_kind, verification_status)
values
  ('81000000-0000-0000-0000-000000000001', 'M1 Multi Business', 'brand', 'pending');

insert into public.kyc_verification_requests(
  id, seller_id, verification_status, required_documents, submitted_documents
)
values
  ('84000000-0000-0000-0000-000000000004', '81000000-0000-0000-0000-000000000001', 'under_review', array['identity'], array['identity']),
  ('85000000-0000-0000-0000-000000000005', '82000000-0000-0000-0000-000000000002', 'under_review', array['identity'], array['identity']);

insert into public.kyc_documents(
  id, seller_id, document_type, file_path, file_name, file_size, mime_type, verification_status
)
values
  ('86000000-0000-0000-0000-000000000006', '81000000-0000-0000-0000-000000000001', 'identity', '81000000-0000-0000-0000-000000000001/identity/test.pdf', 'test.pdf', 128, 'application/pdf', 'pending'),
  ('87000000-0000-0000-0000-000000000007', '82000000-0000-0000-0000-000000000002', 'identity', '82000000-0000-0000-0000-000000000002/identity/test.pdf', 'test.pdf', 128, 'application/pdf', 'pending');

-- ---------------------------------------------------------------------------
-- Canonical identity: Buyer + Seller + Business/BSM coexist on one auth user.
-- ---------------------------------------------------------------------------
do $$
declare
  v_count integer;
begin
  select
    (select count(*) from public.profiles_buyer where id = '81000000-0000-0000-0000-000000000001')
    + (select count(*) from public.profiles_seller where id = '81000000-0000-0000-0000-000000000001')
    + (select count(*) from public.profiles_business where id = '81000000-0000-0000-0000-000000000001')
  into v_count;

  if v_count <> 3 then
    raise exception 'Expected Buyer + Seller + Business capabilities on one identity, found % projections', v_count;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Seller 1 sees only own private KYC metadata and own pending BSM profile.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

do $$
declare
  v_own_requests integer;
  v_other_requests integer;
  v_own_docs integer;
  v_other_docs integer;
  v_own_business integer;
begin
  select count(*) into v_own_requests
  from public.kyc_verification_requests
  where seller_id = auth.uid();

  select count(*) into v_other_requests
  from public.kyc_verification_requests
  where seller_id = '82000000-0000-0000-0000-000000000002';

  select count(*) into v_own_docs
  from public.kyc_documents
  where seller_id = auth.uid();

  select count(*) into v_other_docs
  from public.kyc_documents
  where seller_id = '82000000-0000-0000-0000-000000000002';

  select count(*) into v_own_business
  from public.profiles_business
  where id = auth.uid();

  if v_own_requests <> 1 or v_own_docs <> 1 or v_own_business <> 1 then
    raise exception 'Own M1 private/capability reads failed: requests %, docs %, business %',
      v_own_requests, v_own_docs, v_own_business;
  end if;
  if v_other_requests <> 0 or v_other_docs <> 0 then
    raise exception 'Cross-seller KYC metadata leaked: requests %, docs %', v_other_requests, v_other_docs;
  end if;
end
$$;

-- Browser users have read-only KYC metadata; mutations stay server/service-role only.
do $$
begin
  begin
    insert into public.kyc_documents(
      seller_id, document_type, file_path, file_name, verification_status
    ) values (
      auth.uid(), 'identity', 'forbidden/direct.pdf', 'direct.pdf', 'pending'
    );
    raise exception 'Authenticated browser unexpectedly inserted KYC metadata';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

-- ---------------------------------------------------------------------------
-- Another authenticated account cannot see an unverified Business/BSM profile.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"82000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

do $$
declare
  v_visible integer;
begin
  select count(*) into v_visible
  from public.profiles_business
  where id = '81000000-0000-0000-0000-000000000001';
  if v_visible <> 0 then
    raise exception 'Unverified Business/BSM profile leaked cross-account';
  end if;
end
$$;

-- Verified business profiles are public storefront identity; unverified ones are not.
reset role;
update public.profiles_business
set verification_status = 'verified'
where id = '81000000-0000-0000-0000-000000000001';
set local role anon;

do $$
declare
  v_visible integer;
begin
  select count(*) into v_visible
  from public.profiles_business
  where id = '81000000-0000-0000-0000-000000000001';
  if v_visible <> 1 then
    raise exception 'Verified Business/BSM public profile is not readable';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Privileged KYC transitions are not browser-executable.
-- ---------------------------------------------------------------------------
reset role;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.admin_review_kyc_document(uuid,uuid,text,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.admin_review_kyc_document(uuid,uuid,text,text)',
    'EXECUTE'
  ) then
    raise exception 'Browser role can execute admin_review_kyc_document';
  end if;

  if has_function_privilege(
    'anon',
    'public.admin_complete_seller_kyc(uuid,uuid,text,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.admin_complete_seller_kyc(uuid,uuid,text,text)',
    'EXECUTE'
  ) then
    raise exception 'Browser role can execute admin_complete_seller_kyc';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.admin_review_kyc_document(uuid,uuid,text,text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.admin_complete_seller_kyc(uuid,uuid,text,text)',
    'EXECUTE'
  ) then
    raise exception 'service_role is missing M1 admin KYC RPC execution';
  end if;

  if has_table_privilege('authenticated', 'public.admin_audit_logs', 'SELECT')
     or has_table_privilege('anon', 'public.admin_audit_logs', 'SELECT') then
    raise exception 'Admin audit log is browser-readable';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Admin document review + final seller approval + audit are atomic.
-- ---------------------------------------------------------------------------
set local role service_role;
select public.admin_review_kyc_document(
  '83000000-0000-0000-0000-000000000003',
  '86000000-0000-0000-0000-000000000006',
  'approved',
  null
);

do $$
declare
  v_status text;
  v_audits integer;
begin
  select verification_status into v_status
  from public.kyc_documents
  where id = '86000000-0000-0000-0000-000000000006';

  select count(*) into v_audits
  from public.admin_audit_logs
  where admin_id = '83000000-0000-0000-0000-000000000003'
    and action = 'document_review'
    and target_id = '86000000-0000-0000-0000-000000000006';

  if v_status <> 'approved' or v_audits <> 1 then
    raise exception 'Atomic document review failed: status %, audits %', v_status, v_audits;
  end if;
end
$$;

-- A second decision on the same document is rejected instead of overwriting history.
do $$
begin
  begin
    perform public.admin_review_kyc_document(
      '83000000-0000-0000-0000-000000000003',
      '86000000-0000-0000-0000-000000000006',
      'rejected',
      'late overwrite'
    );
    raise exception 'Expected repeat document review to fail';
  exception
    when raise_exception then
      if sqlerrm <> 'kyc_document_already_reviewed' then raise; end if;
  end;
end
$$;

select public.admin_complete_seller_kyc(
  '83000000-0000-0000-0000-000000000003',
  '84000000-0000-0000-0000-000000000004',
  'approved',
  'M1 regression approval'
);

do $$
declare
  v_request_status text;
  v_seller_status text;
  v_audits integer;
begin
  select verification_status into v_request_status
  from public.kyc_verification_requests
  where id = '84000000-0000-0000-0000-000000000004';

  select verification_status into v_seller_status
  from public.profiles_seller
  where id = '81000000-0000-0000-0000-000000000001';

  select count(*) into v_audits
  from public.admin_audit_logs
  where admin_id = '83000000-0000-0000-0000-000000000003'
    and action = 'verification_complete'
    and target_id = '84000000-0000-0000-0000-000000000004';

  if v_request_status <> 'approved' or v_seller_status <> 'verified' or v_audits <> 1 then
    raise exception 'Atomic final KYC approval failed: request %, seller %, audits %',
      v_request_status, v_seller_status, v_audits;
  end if;
end
$$;

-- Approval fails closed when any required document lacks an approved submission.
do $$
begin
  begin
    perform public.admin_complete_seller_kyc(
      '83000000-0000-0000-0000-000000000003',
      '85000000-0000-0000-0000-000000000005',
      'approved',
      null
    );
    raise exception 'Expected KYC approval with unapproved required document to fail';
  exception
    when raise_exception then
      if sqlerrm not like 'required_document_not_approved:%' then raise; end if;
  end;
end
$$;

rollback;

select 'M1 identity/KYC/storage regression suite passed' as result;
