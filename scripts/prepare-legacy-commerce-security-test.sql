\set ON_ERROR_STOP on

-- Disposable-CI compatibility shim for the historical P0 commerce regression.
-- M3 deliberately removed authenticated execution from the legacy arbitrary
-- item/address checkout RPC. The canonical browser contract is v2. We assert
-- that boundary first, then temporarily grant the legacy RPC only so the older
-- regression can continue exercising its payment/finalization/fulfillment
-- scenarios. CI revokes this grant immediately after that regression.

do $$
begin
  if has_function_privilege(
       'authenticated',
       'public.create_checkout_session(jsonb,jsonb,uuid)',
       'EXECUTE'
     ) then
    raise exception 'Legacy checkout RPC unexpectedly remains browser executable';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.create_checkout_session_v2(uuid,uuid,uuid)',
       'EXECUTE'
     ) then
    raise exception 'Canonical M3 checkout v2 is not authenticated executable';
  end if;
end
$$;

grant execute on function public.create_checkout_session(jsonb,jsonb,uuid)
  to authenticated;
