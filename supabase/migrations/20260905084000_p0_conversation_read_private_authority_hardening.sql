-- EntizNetStore P0 — reduce browser-callable SECURITY DEFINER surface for
-- legacy conversation read-state mutation.
--
-- Preserve the existing audited function object by moving it into the
-- non-exposed app_private schema, then expose the same public RPC signature
-- only as a SECURITY INVOKER delegate. Recipient identity remains derived
-- exclusively from auth.uid().

begin;

alter function public.mark_conversation_read(uuid) set schema app_private;
alter function app_private.mark_conversation_read(uuid) rename to mark_conversation_read_authority;

create function public.mark_conversation_read(target_conversation_id uuid)
returns void
language sql
security invoker
set search_path = 'pg_catalog'
as $$
  select app_private.mark_conversation_read_authority(target_conversation_id);
$$;

grant usage on schema app_private to authenticated, service_role;

revoke all on function app_private.mark_conversation_read_authority(uuid) from public, anon;
grant execute on function app_private.mark_conversation_read_authority(uuid) to authenticated, service_role;

revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated, service_role;

commit;
