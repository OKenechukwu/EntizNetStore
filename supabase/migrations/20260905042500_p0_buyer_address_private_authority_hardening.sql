-- EntizNetStore P0 — reduce browser-callable SECURITY DEFINER surface for
-- Buyer address create/update/delete mutations while preserving checkout-safe
-- address ownership and default-address behavior.
--
-- Move the existing audited function objects into non-exposed app_private so
-- their exact validation, ownership and error semantics are retained. Recreate
-- the public Data API signatures only as SECURITY INVOKER delegates.

begin;

alter function public.buyer_save_address(uuid,text,boolean,text,text,text,text,text,text,text,text,text,text,text)
  set schema app_private;
alter function app_private.buyer_save_address(uuid,text,boolean,text,text,text,text,text,text,text,text,text,text,text)
  rename to buyer_save_address_authority;

alter function public.buyer_delete_address(uuid) set schema app_private;
alter function app_private.buyer_delete_address(uuid) rename to buyer_delete_address_authority;

create function public.buyer_save_address(
  p_address_id uuid,
  p_nickname text,
  p_is_default boolean,
  p_type text,
  p_first_name text,
  p_last_name text,
  p_company text,
  p_address_line1 text,
  p_address_line2 text,
  p_city text,
  p_state_province text,
  p_postal_code text,
  p_country text,
  p_phone text
)
returns uuid
language sql
security invoker
set search_path = 'pg_catalog'
as $$
  select app_private.buyer_save_address_authority(
    p_address_id, p_nickname, p_is_default, p_type,
    p_first_name, p_last_name, p_company, p_address_line1,
    p_address_line2, p_city, p_state_province, p_postal_code,
    p_country, p_phone
  );
$$;

create function public.buyer_delete_address(p_address_id uuid)
returns void
language sql
security invoker
set search_path = 'pg_catalog'
as $$
  select app_private.buyer_delete_address_authority(p_address_id);
$$;

grant usage on schema app_private to authenticated, service_role;

revoke all on function app_private.buyer_save_address_authority(uuid,text,boolean,text,text,text,text,text,text,text,text,text,text,text) from public, anon;
revoke all on function app_private.buyer_delete_address_authority(uuid) from public, anon;
grant execute on function app_private.buyer_save_address_authority(uuid,text,boolean,text,text,text,text,text,text,text,text,text,text,text) to authenticated, service_role;
grant execute on function app_private.buyer_delete_address_authority(uuid) to authenticated, service_role;

revoke all on function public.buyer_save_address(uuid,text,boolean,text,text,text,text,text,text,text,text,text,text,text) from public, anon;
revoke all on function public.buyer_delete_address(uuid) from public, anon;
grant execute on function public.buyer_save_address(uuid,text,boolean,text,text,text,text,text,text,text,text,text,text,text) to authenticated, service_role;
grant execute on function public.buyer_delete_address(uuid) to authenticated, service_role;

commit;
