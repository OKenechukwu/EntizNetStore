-- M1 follow-up: Business/BSM is sell-capable and shares the seller KYC decision.
-- Preserve the separate Business projection while synchronizing the final
-- verification result atomically with Seller + audit state.

begin;

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
  v_business_rows integer := 0;
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

  update public.profiles_business
  set verification_status = v_seller_status,
      updated_at = now()
  where id = v_request.seller_id;

  get diagnostics v_business_rows = row_count;

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
      'business_status_synced', v_business_rows > 0,
      'notes', nullif(btrim(coalesce(p_notes, '')), '')
    ),
    now()
  );
end;
$$;

revoke all on function public.admin_complete_seller_kyc(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_complete_seller_kyc(uuid, uuid, text, text)
  to service_role;

commit;
