-- M1: make KYC review state transitions and audit logging atomic.
-- These functions are service-role only. The calling API separately validates
-- the authenticated administrator via trusted app_metadata before invoking them.

begin;

create or replace function public.admin_review_kyc_document(
  p_admin_id uuid,
  p_document_id uuid,
  p_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_document public.kyc_documents%rowtype;
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'invalid_document_review_status';
  end if;
  if p_status = 'rejected' and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'rejection_reason_required';
  end if;

  select * into v_document
  from public.kyc_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'kyc_document_not_found';
  end if;
  if v_document.verification_status <> 'pending' then
    raise exception 'kyc_document_already_reviewed';
  end if;

  update public.kyc_documents
  set verification_status = p_status,
      reviewed_at = now(),
      reviewed_by = p_admin_id,
      rejection_reason = case when p_status = 'rejected' then btrim(p_reason) else null end
  where id = p_document_id;

  insert into public.admin_audit_logs (
    admin_id, action, target_type, target_id, metadata, timestamp
  ) values (
    p_admin_id,
    'document_review',
    'kyc_document',
    p_document_id::text,
    jsonb_build_object(
      'document_id', p_document_id,
      'seller_id', v_document.seller_id,
      'action', p_status,
      'reason', case when p_status = 'rejected' then btrim(p_reason) else null end
    ),
    now()
  );
end;
$$;

create or replace function public.admin_complete_seller_kyc(
  p_admin_id uuid,
  p_request_id uuid,
  p_status text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.kyc_verification_requests%rowtype;
  v_missing text;
  v_seller_status text;
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'invalid_verification_status';
  end if;
  if p_status = 'rejected' and nullif(btrim(coalesce(p_notes, '')), '') is null then
    raise exception 'reviewer_notes_required';
  end if;

  select * into v_request
  from public.kyc_verification_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'verification_request_not_found';
  end if;
  if v_request.verification_status in ('approved', 'rejected') then
    raise exception 'verification_request_already_final';
  end if;

  if p_status = 'approved' then
    select t.required_type into v_missing
    from unnest(coalesce(v_request.required_documents, array[]::text[])) as t(required_type)
    where not exists (
      select 1
      from public.kyc_documents d
      where d.seller_id = v_request.seller_id
        and d.document_type = t.required_type
        and d.verification_status = 'approved'
    )
    limit 1;

    if v_missing is not null then
      raise exception 'required_document_not_approved:%', v_missing;
    end if;
  end if;

  v_seller_status := case when p_status = 'approved' then 'verified' else 'rejected' end;

  update public.kyc_verification_requests
  set verification_status = p_status,
      review_date = now(),
      reviewer_notes = nullif(btrim(coalesce(p_notes, '')), '')
  where id = p_request_id;

  update public.profiles_seller
  set verification_status = v_seller_status,
      updated_at = now()
  where id = v_request.seller_id;

  if not found then
    raise exception 'seller_profile_not_found';
  end if;

  insert into public.admin_audit_logs (
    admin_id, action, target_type, target_id, metadata, timestamp
  ) values (
    p_admin_id,
    'verification_complete',
    'verification_request',
    p_request_id::text,
    jsonb_build_object(
      'request_id', p_request_id,
      'seller_id', v_request.seller_id,
      'action', p_status,
      'seller_status', v_seller_status,
      'notes', nullif(btrim(coalesce(p_notes, '')), '')
    ),
    now()
  );
end;
$$;

revoke all on function public.admin_review_kyc_document(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_complete_seller_kyc(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_review_kyc_document(uuid, uuid, text, text) to service_role;
grant execute on function public.admin_complete_seller_kyc(uuid, uuid, text, text) to service_role;

commit;
