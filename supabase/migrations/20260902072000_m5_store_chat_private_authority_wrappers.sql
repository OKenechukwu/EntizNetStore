-- EntizNetStore M5 — keep privileged Store Chat implementations out of the
-- exposed public Data API schema.
--
-- The public RPC names remain stable for application clients, but become thin
-- SECURITY INVOKER wrappers. Their privileged implementations live in the
-- non-exposed app_private schema with tightly scoped EXECUTE grants. This follows
-- the fail-closed pattern already used for internal marketplace capability
-- helpers and materially reduces exposed SECURITY DEFINER surface.

begin;

-- Move the already-reviewed implementations without rewriting their bodies.
-- ALTER FUNCTION preserves the function object and implementation while the
-- subsequent revoke/grant sequence deliberately resets its callable surface.
alter function public.open_store_conversation(text,uuid)
  set schema app_private;
alter function app_private.open_store_conversation(text,uuid)
  rename to open_store_conversation_authority;

alter function public.send_store_message(uuid,text,text,text,text)
  set schema app_private;
alter function app_private.send_store_message(uuid,text,text,text,text)
  rename to send_store_message_authority;

alter function public.mark_store_conversation_read(uuid)
  set schema app_private;
alter function app_private.mark_store_conversation_read(uuid)
  rename to mark_store_conversation_read_authority;

revoke all on function app_private.open_store_conversation_authority(text,uuid)
  from public, anon, authenticated;
revoke all on function app_private.send_store_message_authority(uuid,text,text,text,text)
  from public, anon, authenticated;
revoke all on function app_private.mark_store_conversation_read_authority(uuid)
  from public, anon, authenticated;

-- The authenticated role may execute these only through SQL invoked from the
-- public wrappers. app_private is not an exposed PostgREST schema, so the
-- authority functions are not directly addressable as Data API RPC endpoints.
grant usage on schema app_private to authenticated, service_role;
grant execute on function app_private.open_store_conversation_authority(text,uuid)
  to authenticated, service_role;
grant execute on function app_private.send_store_message_authority(uuid,text,text,text,text)
  to authenticated, service_role;
grant execute on function app_private.mark_store_conversation_read_authority(uuid)
  to authenticated, service_role;

-- Stable public API, invoker rights only. Every wrapper is schema-qualified and
-- accepts exactly the minimal inputs already reviewed by M5. In particular,
-- send_store_message still has no caller-supplied recipient or order authority.
create function public.open_store_conversation(
  p_context_type text,
  p_context_id uuid
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, app_private
as $$
  select app_private.open_store_conversation_authority(p_context_type, p_context_id)
$$;

create function public.send_store_message(
  p_conversation_id uuid,
  p_ciphertext text,
  p_iv text,
  p_encryption_version text,
  p_message_type text default 'text'
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, app_private
as $$
  select app_private.send_store_message_authority(
    p_conversation_id,
    p_ciphertext,
    p_iv,
    p_encryption_version,
    p_message_type
  )
$$;

create function public.mark_store_conversation_read(
  p_conversation_id uuid
)
returns integer
language sql
security invoker
set search_path = pg_catalog, public, app_private
as $$
  select app_private.mark_store_conversation_read_authority(p_conversation_id)
$$;

-- PostgreSQL functions are executable by PUBLIC by default; revoke before the
-- explicit role grants so the wrappers cannot become anonymous RPCs.
revoke all on function public.open_store_conversation(text,uuid)
  from public, anon;
revoke all on function public.send_store_message(uuid,text,text,text,text)
  from public, anon;
revoke all on function public.mark_store_conversation_read(uuid)
  from public, anon;

grant execute on function public.open_store_conversation(text,uuid)
  to authenticated, service_role;
grant execute on function public.send_store_message(uuid,text,text,text,text)
  to authenticated, service_role;
grant execute on function public.mark_store_conversation_read(uuid)
  to authenticated, service_role;

commit;
