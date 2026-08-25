\set ON_ERROR_STOP on

begin;

-- The ledger must remain outside the exposed public schema and deny direct
-- client-role access even if app_private is ever accidentally exposed.
do $$
begin
  if to_regclass('app_private.operational_events') is null then
    raise exception 'operational event ledger missing';
  end if;

  if not coalesce((
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'app_private' and c.relname = 'operational_events'
  ), false) then
    raise exception 'operational event ledger must have RLS enabled';
  end if;

  if has_table_privilege('anon', 'app_private.operational_events', 'select')
     or has_table_privilege('authenticated', 'app_private.operational_events', 'select')
     or has_table_privilege('anon', 'app_private.operational_events', 'insert')
     or has_table_privilege('authenticated', 'app_private.operational_events', 'insert') then
    raise exception 'client roles must not access operational event rows';
  end if;

  if has_function_privilege(
       'anon',
       'public.record_operational_event(text,text,text,text,text,text,text,text,text,integer)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.record_operational_event(text,text,text,text,text,text,text,text,text,integer)',
       'execute'
     ) then
    raise exception 'client roles must not record operational events';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.record_operational_event(text,text,text,text,text,text,text,text,text,integer)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.operational_event_health(integer,integer)',
       'execute'
     ) then
    raise exception 'service role must own the operational event RPC boundary';
  end if;
end;
$$;

-- Sensitive values have no column in the ledger by construction.
do $$
declare
  forbidden_columns text[] := array[
    'error_message', 'metadata', 'payload', 'provider_payload', 'file_path',
    'signed_url', 'token', 'actor_id', 'record_id', 'user_id'
  ];
  forbidden_column_name text;
begin
  foreach forbidden_column_name in array forbidden_columns loop
    if exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'app_private'
        and c.table_name = 'operational_events'
        and c.column_name = forbidden_column_name
    ) then
      raise exception 'forbidden sensitive ledger column exists: %', forbidden_column_name;
    end if;
  end loop;
end;
$$;

-- Service-role writes are accepted only through the bounded RPC surface.
set local role service_role;
select public.record_operational_event(
  'storage.kyc.upload_failed',
  'storage',
  'upload-object',
  'error',
  'kyc-documents',
  '/api/kyc/documents',
  '0123456789abcdef',
  'fedcba9876543210',
  'storage_error',
  503
);
reset role;

do $$
declare
  row_count integer;
begin
  select count(*) into row_count
  from app_private.operational_events
  where event = 'storage.kyc.upload_failed'
    and actor_fingerprint = '0123456789abcdef'
    and record_fingerprint = 'fedcba9876543210'
    and error_code = 'storage_error'
    and error_status = 503;

  if row_count <> 1 then
    raise exception 'bounded operational event was not persisted';
  end if;
end;
$$;

-- A single failure must not trip the repeated-failure threshold.
do $$
declare
  health_status text;
  count_value bigint;
begin
  select h.status, h.failure_count
  into health_status, count_value
  from public.operational_event_health(15, 5) h;

  if health_status <> 'ok' or count_value <> 0 then
    raise exception 'single operational failure must not mark aggregate health degraded';
  end if;
end;
$$;

-- Five matching failures within the window must become an actionable signal.
set local role service_role;
select public.record_operational_event('storage.product_media.upload_failed','storage','upload-object','error','product-media','/api/seller/product-media/upload',null,null,'storage_error',503);
select public.record_operational_event('storage.product_media.upload_failed','storage','upload-object','error','product-media','/api/seller/product-media/upload',null,null,'storage_error',503);
select public.record_operational_event('storage.product_media.upload_failed','storage','upload-object','error','product-media','/api/seller/product-media/upload',null,null,'storage_error',503);
select public.record_operational_event('storage.product_media.upload_failed','storage','upload-object','error','product-media','/api/seller/product-media/upload',null,null,'storage_error',503);
select public.record_operational_event('storage.product_media.upload_failed','storage','upload-object','error','product-media','/api/seller/product-media/upload',null,null,'storage_error',503);
reset role;

do $$
declare
  health_status text;
  event_name text;
  component_name text;
  count_value bigint;
begin
  select h.status, h.failing_event, h.failing_component, h.failure_count
  into health_status, event_name, component_name, count_value
  from public.operational_event_health(15, 5) h;

  if health_status <> 'degraded'
     or event_name <> 'storage.product_media.upload_failed'
     or component_name <> 'storage'
     or count_value < 5 then
    raise exception 'repeated operational failures must mark aggregate health degraded';
  end if;
end;
$$;

-- Opportunistic retention cleanup removes events older than 30 days on write.
insert into app_private.operational_events(event, component, operation, severity, occurred_at)
values ('storage.retention.old_event', 'storage', 'retention-test', 'warning', now() - interval '31 days');

set local role service_role;
select public.record_operational_event('storage.retention.trigger','storage','retention-test','warning');
reset role;

do $$
begin
  if exists (
    select 1 from app_private.operational_events
    where event = 'storage.retention.old_event'
  ) then
    raise exception 'operational event retention must remove rows older than 30 days';
  end if;
end;
$$;

rollback;
