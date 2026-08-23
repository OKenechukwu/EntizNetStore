\set ON_ERROR_STOP on

begin;

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('00000000-0000-0000-0000-000000000000','ea000000-0000-0000-0000-000000000001','authenticated','authenticated','link-admin@test.invalid','',now(),'{"role":"admin"}'::jsonb,'{}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','eb000000-0000-0000-0000-000000000002','authenticated','authenticated','standalone@test.invalid','',now(),'{}'::jsonb,'{}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','ec000000-0000-0000-0000-000000000003','authenticated','authenticated','linked@test.invalid','',now(),'{}'::jsonb,'{}'::jsonb,now(),now());

insert into public.profiles_buyer(id,display_name) values
  ('eb000000-0000-0000-0000-000000000002','Standalone User'),
  ('ec000000-0000-0000-0000-000000000003','Linked User');
insert into public.profiles_seller(id,storefront_name,verification_status,return_policy,shipping_policy) values
  ('eb000000-0000-0000-0000-000000000002','Standalone Store','verified','Return policy','Shipping policy'),
  ('ec000000-0000-0000-0000-000000000003','Linked Store','verified','Return policy','Shipping policy');

-- Service-only integration helpers must not be browser executable.
do $$
declare v_fn text;
begin
  foreach v_fn in array array[
    'public.resolve_store_auth_user_by_email(text)',
    'public.sync_entiznet_store_capabilities(uuid,text[],text)',
    'public.upsert_entiznet_identity_link(uuid,uuid,text[],text,text,jsonb)',
    'public.revoke_entiznet_identity_link(uuid,text)',
    'public.register_entiznet_handoff(text,uuid,text,text,text,text[],timestamp with time zone,timestamp with time zone,jsonb)',
    'public.complete_entiznet_handoff(uuid,uuid,text,text)'
  ] loop
    if has_function_privilege('anon',v_fn,'EXECUTE')
       or has_function_privilege('authenticated',v_fn,'EXECUTE')
       or not has_function_privilege('service_role',v_fn,'EXECUTE') then
      raise exception 'EntizNet integration RPC privilege boundary failed for %', v_fn;
    end if;
  end loop;
end
$$;

set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);

-- Standalone users remain governed by their local Store profile + suspension
-- state when no EntizNet identity link exists.
do $$
begin
  if not public.marketplace_capability_is_active('eb000000-0000-0000-0000-000000000002','buyer')
     or not public.marketplace_capability_is_active('eb000000-0000-0000-0000-000000000002','seller') then
    raise exception 'Standalone Store capabilities were incorrectly disabled';
  end if;
end
$$;

select public.resolve_store_auth_user_by_email(' LINKED@TEST.INVALID ') as resolved_id \gset

do $$
begin
  if :'resolved_id' <> 'ec000000-0000-0000-0000-000000000003' then
    raise exception 'Store auth email resolution returned wrong identity';
  end if;
end
$$;

-- Link the existing Store user to an EntizNet identity with Buyer only. An old
-- local Seller profile remains for history but is no longer authorization.
select public.upsert_entiznet_identity_link(
  'ec000000-0000-0000-0000-000000000003',
  'ed000000-0000-0000-0000-000000000004',
  array['entiznetstore_buyer'],
  'v1',
  'entiznet_handoff',
  '{}'::jsonb
);

do $$
begin
  if not public.marketplace_capability_is_active('ec000000-0000-0000-0000-000000000003','buyer') then
    raise exception 'Linked Buyer capability was not granted';
  end if;
  if public.marketplace_capability_is_active('ec000000-0000-0000-0000-000000000003','seller')
     or public.marketplace_capability_is_active('ec000000-0000-0000-0000-000000000003','business') then
    raise exception 'Linked account retained capabilities absent from EntizNet snapshot';
  end if;
end
$$;

-- Business is the Store BSM capability and materializes Buyer+Seller+Business.
select public.sync_entiznet_store_capabilities(
  'ec000000-0000-0000-0000-000000000003',
  array['entiznetstore_business'],
  'Linked Business'
);
select public.upsert_entiznet_identity_link(
  'ec000000-0000-0000-0000-000000000003',
  'ed000000-0000-0000-0000-000000000004',
  array['entiznetstore_business'],
  'v2',
  'entiznet_handoff',
  '{}'::jsonb
);

do $$
begin
  if not exists (select 1 from public.profiles_business where id='ec000000-0000-0000-0000-000000000003') then
    raise exception 'Business handoff did not materialize Store Business profile';
  end if;
  if not public.marketplace_capability_is_active('ec000000-0000-0000-0000-000000000003','buyer')
     or not public.marketplace_capability_is_active('ec000000-0000-0000-0000-000000000003','seller')
     or not public.marketplace_capability_is_active('ec000000-0000-0000-0000-000000000003','business') then
    raise exception 'Business capability did not map to Buyer+Seller+Business';
  end if;
end
$$;

-- Local Store suspension is an additional deny even when EntizNet grants the
-- capability. Suspending Seller must not accidentally suspend Buyer/Business.
select public.admin_set_marketplace_capability_state(
  'ea000000-0000-0000-0000-000000000001',
  'ec000000-0000-0000-0000-000000000003',
  'seller','suspended','Integration regression suspension'
);

do $$
begin
  if public.marketplace_capability_is_active('ec000000-0000-0000-0000-000000000003','seller') then
    raise exception 'Local Seller suspension did not override EntizNet grant';
  end if;
  if not public.marketplace_capability_is_active('ec000000-0000-0000-0000-000000000003','buyer')
     or not public.marketplace_capability_is_active('ec000000-0000-0000-0000-000000000003','business') then
    raise exception 'Seller suspension leaked into other capabilities';
  end if;
end
$$;

-- Revoking the identity link disables all linked capabilities without deleting
-- historical profile data. A later valid handoff may explicitly reactivate it.
select public.revoke_entiznet_identity_link(
  'ed000000-0000-0000-0000-000000000004',
  'Integration regression revocation'
);

do $$
begin
  if public.marketplace_capability_is_active('ec000000-0000-0000-0000-000000000003','buyer')
     or public.marketplace_capability_is_active('ec000000-0000-0000-0000-000000000003','seller')
     or public.marketplace_capability_is_active('ec000000-0000-0000-0000-000000000003','business') then
    raise exception 'Revoked EntizNet link retained Store capability access';
  end if;
  if not exists (select 1 from public.profiles_seller where id='ec000000-0000-0000-0000-000000000003') then
    raise exception 'Link revocation destructively deleted Store history profile';
  end if;
end
$$;

-- Handoff JTI hashes are one-time. Replay is rejected before session issuance.
select public.register_entiznet_handoff(
  repeat('a',64),
  'ed000000-0000-0000-0000-000000000004',
  'entiznet','entiznetstore','/store',
  array['entiznetstore_buyer'],
  now(),now()+interval '90 seconds','{}'::jsonb
) as event_id \gset

do $$
begin
  begin
    perform public.register_entiznet_handoff(
      repeat('a',64),
      'ed000000-0000-0000-0000-000000000004',
      'entiznet','entiznetstore','/store',
      array['entiznetstore_buyer'],
      now(),now()+interval '90 seconds','{}'::jsonb
    );
    raise exception 'Handoff replay unexpectedly succeeded';
  exception when unique_violation then null;
  end;
end
$$;

select public.complete_entiznet_handoff(
  :'event_id'::uuid,
  'ec000000-0000-0000-0000-000000000003',
  'consumed',null
);

rollback;
select 'M3 EntizNet linked capability authority regression suite passed' as result;
