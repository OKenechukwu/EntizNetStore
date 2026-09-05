-- EntizNetStore P0 — reduce browser-callable SECURITY DEFINER surface for BSM
-- trading-role and wholesale-offer authoring.
--
-- Move the existing audited function objects into non-exposed app_private so
-- their exact business logic and ownership semantics are retained. Recreate the
-- public Data API signatures only as SECURITY INVOKER delegates.

begin;

alter function public.business_set_trading_roles(text[]) set schema app_private;
alter function app_private.business_set_trading_roles(text[]) rename to business_set_trading_roles_authority;

alter function public.business_save_wholesale_offer(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamp with time zone,timestamp with time zone,jsonb)
  set schema app_private;
alter function app_private.business_save_wholesale_offer(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamp with time zone,timestamp with time zone,jsonb)
  rename to business_save_wholesale_offer_authority;

create function public.business_set_trading_roles(p_roles text[])
returns text[]
language sql
security invoker
set search_path = 'pg_catalog'
as $$ select app_private.business_set_trading_roles_authority(p_roles); $$;

create function public.business_save_wholesale_offer(
  p_offer_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_status text,
  p_minimum_order_quantity integer,
  p_order_multiple integer,
  p_unit_label text,
  p_case_pack_size integer,
  p_lead_time_days integer,
  p_incoterm text,
  p_starts_at timestamp with time zone,
  p_ends_at timestamp with time zone,
  p_tiers jsonb
)
returns uuid
language sql
security invoker
set search_path = 'pg_catalog'
as $$
  select app_private.business_save_wholesale_offer_authority(
    p_offer_id, p_product_id, p_variant_id, p_status,
    p_minimum_order_quantity, p_order_multiple, p_unit_label,
    p_case_pack_size, p_lead_time_days, p_incoterm,
    p_starts_at, p_ends_at, p_tiers
  );
$$;

grant usage on schema app_private to authenticated, service_role;

revoke all on function app_private.business_set_trading_roles_authority(text[]) from public, anon;
revoke all on function app_private.business_save_wholesale_offer_authority(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamp with time zone,timestamp with time zone,jsonb) from public, anon;
grant execute on function app_private.business_set_trading_roles_authority(text[]) to authenticated, service_role;
grant execute on function app_private.business_save_wholesale_offer_authority(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamp with time zone,timestamp with time zone,jsonb) to authenticated, service_role;

revoke all on function public.business_set_trading_roles(text[]) from public, anon;
revoke all on function public.business_save_wholesale_offer(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamp with time zone,timestamp with time zone,jsonb) from public, anon;
grant execute on function public.business_set_trading_roles(text[]) to authenticated, service_role;
grant execute on function public.business_save_wholesale_offer(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamp with time zone,timestamp with time zone,jsonb) to authenticated, service_role;

commit;
