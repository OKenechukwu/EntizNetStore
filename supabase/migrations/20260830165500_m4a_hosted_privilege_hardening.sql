-- EntizNetStore M4A hosted privilege hardening.
--
-- Hosted Supabase applies default SELECT + MAINTAIN grants to newly created
-- public tables for browser roles. RLS still prevented row leakage, but M4A's
-- least-privilege contract requires anonymous callers to have no table-level
-- access and authenticated callers to have SELECT only. Make that boundary
-- explicit so behavior is stable across local and hosted Supabase runtimes.

begin;

revoke all privileges
  on public.business_trading_roles,
     public.wholesale_offers,
     public.wholesale_offer_tiers
  from anon, authenticated;

grant select
  on public.business_trading_roles,
     public.wholesale_offers,
     public.wholesale_offer_tiers
  to authenticated;

grant all privileges
  on public.business_trading_roles,
     public.wholesale_offers,
     public.wholesale_offer_tiers
  to service_role;

commit;
