begin;

alter function public.submit_marketplace_report(text, uuid, text, text)
  set schema app_private;

alter function app_private.submit_marketplace_report(text, uuid, text, text)
  rename to submit_marketplace_report_authority;

create function public.submit_marketplace_report(
  p_subject_type text,
  p_subject_id uuid,
  p_reason_code text,
  p_details text
)
returns uuid
language sql
security invoker
set search_path = 'pg_catalog'
as $$
  select app_private.submit_marketplace_report_authority(
    p_subject_type,
    p_subject_id,
    p_reason_code,
    p_details
  );
$$;

grant usage on schema app_private to authenticated, service_role;

revoke all on function app_private.submit_marketplace_report_authority(text, uuid, text, text)
  from public, anon;
grant execute on function app_private.submit_marketplace_report_authority(text, uuid, text, text)
  to authenticated, service_role;

revoke all on function public.submit_marketplace_report(text, uuid, text, text)
  from public, anon;
grant execute on function public.submit_marketplace_report(text, uuid, text, text)
  to authenticated, service_role;

commit;
