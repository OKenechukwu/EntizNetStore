\set ON_ERROR_STOP on

begin;

-- The replay/audit ledger must remain outside the exposed public schema.
do $$
begin
  if to_regclass('public.entiznet_admin_api_requests') is not null then
    raise exception 'EntizNet Admin request ledger leaked into public schema';
  end if;
  if to_regclass('app_private.entiznet_admin_api_requests') is null then
    raise exception 'Private EntizNet Admin request ledger is missing';
  end if;
  if has_table_privilege('anon', 'app_private.entiznet_admin_api_requests', 'SELECT')
     or has_table_privilege('authenticated', 'app_private.entiznet_admin_api_requests', 'SELECT') then
    raise exception 'Browser role can read EntizNet Admin request ledger';
  end if;
end
$$;

-- All cross-product Admin RPCs are trusted-worker-only.
do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public.register_entiznet_admin_api_request(text,uuid,text,text,text[],text,text,timestamptz,timestamptz,jsonb)',
    'public.complete_entiznet_admin_api_request(uuid,text,text,jsonb)',
    'public.entiznet_admin_search_marketplace_accounts(uuid,text,text,text,integer,integer)'
  ] loop
    if has_function_privilege('anon', v_fn, 'EXECUTE')
       or has_function_privilege('authenticated', v_fn, 'EXECUTE')
       or not has_function_privilege('service_role', v_fn, 'EXECUTE') then
      raise exception 'EntizNet Admin service RPC boundary is incorrect: %', v_fn;
    end if;
  end loop;
end
$$;

set local role service_role;

select public.register_entiznet_admin_api_request(
  repeat('a', 64),
  'b1000000-0000-4000-8000-000000000001'::uuid,
  'entiznet',
  'entiznetstore-admin-api',
  array['store.accounts.read']::text[],
  '/api/integrations/entiznet/admin/accounts',
  'GET',
  now(),
  now() + interval '60 seconds',
  '{"test":true}'::jsonb
) as request_id \gset

select public.complete_entiznet_admin_api_request(
  :'request_id'::uuid,
  'completed',
  null,
  '{"rows":0}'::jsonb
);

-- The service-only account read model can execute for an external EntizNet
-- actor without manufacturing a Store auth/Admin identity.
select count(*) as account_rows
from public.entiznet_admin_search_marketplace_accounts(
  'b1000000-0000-4000-8000-000000000001'::uuid,
  '', 'all', 'all', 10, 0
);

-- Exact replay must fail on the unique JTI hash.
do $$
begin
  begin
    perform public.register_entiznet_admin_api_request(
      repeat('a', 64),
      'b1000000-0000-4000-8000-000000000001'::uuid,
      'entiznet',
      'entiznetstore-admin-api',
      array['store.accounts.read']::text[],
      '/api/integrations/entiznet/admin/accounts',
      'GET',
      now(),
      now() + interval '60 seconds',
      '{}'::jsonb
    );
    raise exception 'Replayed EntizNet Admin request unexpectedly succeeded';
  exception when unique_violation then
    null;
  end;
end
$$;

reset role;

do $$
declare
  v_status text;
  v_actor uuid;
begin
  select status, entiznet_admin_id into v_status, v_actor
  from app_private.entiznet_admin_api_requests
  where jti_hash = repeat('a', 64);

  if v_status <> 'completed'
     or v_actor <> 'b1000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'EntizNet Admin request audit state is incorrect';
  end if;
end
$$;

rollback;

select 'EntizNet Admin service boundary regression suite passed' as result;
