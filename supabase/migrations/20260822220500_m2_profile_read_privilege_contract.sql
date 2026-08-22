-- EntizNetStore M2 follow-up: RLS policies and table privileges are separate
-- authorization gates. Make the public/owner profile read contract explicit so
-- fresh Supabase environments never depend on platform-default grants.

begin;

grant select on table public.profiles_seller to anon, authenticated;
grant select on table public.profiles_buyer to authenticated;
grant select on table public.profiles_business to anon, authenticated;

-- Browser roles remain read-only. All profile capability creation/mutation is
-- still brokered by trusted server routes/service role.
revoke insert, update, delete, truncate, references, trigger
  on public.profiles_seller, public.profiles_buyer, public.profiles_business
  from anon, authenticated;

commit;
