-- EntizNetStore P0 — reduce browser-callable SECURITY DEFINER surface for
-- notification read-state mutations.
--
-- Preserve the existing audited function objects by moving them into
-- non-exposed app_private, then expose the same public RPC signatures only as
-- SECURITY INVOKER delegates. Caller identity remains derived from auth.uid().

begin;

alter function public.mark_notification_read(uuid) set schema app_private;
alter function app_private.mark_notification_read(uuid) rename to mark_notification_read_authority;

alter function public.mark_all_notifications_read() set schema app_private;
alter function app_private.mark_all_notifications_read() rename to mark_all_notifications_read_authority;

create function public.mark_notification_read(p_notification_id uuid)
returns void
language sql
security invoker
set search_path = 'pg_catalog'
as $$
  select app_private.mark_notification_read_authority(p_notification_id);
$$;

create function public.mark_all_notifications_read()
returns integer
language sql
security invoker
set search_path = 'pg_catalog'
as $$
  select app_private.mark_all_notifications_read_authority();
$$;

grant usage on schema app_private to authenticated, service_role;

revoke all on function app_private.mark_notification_read_authority(uuid) from public, anon;
revoke all on function app_private.mark_all_notifications_read_authority() from public, anon;
grant execute on function app_private.mark_notification_read_authority(uuid) to authenticated, service_role;
grant execute on function app_private.mark_all_notifications_read_authority() to authenticated, service_role;

revoke all on function public.mark_notification_read(uuid) from public, anon;
revoke all on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated, service_role;
grant execute on function public.mark_all_notifications_read() to authenticated, service_role;

commit;
