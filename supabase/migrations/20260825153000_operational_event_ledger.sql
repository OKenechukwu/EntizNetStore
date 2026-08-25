-- EntizNetStore — private operational failure ledger.
-- Stores only bounded, already-redacted operational metadata. Raw provider
-- payloads, error messages, URLs, storage paths, user UUIDs and KYC filenames
-- do not belong in this table or its RPC surface.

begin;

create schema if not exists app_private;

create table app_private.operational_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  component text not null,
  operation text not null,
  severity text not null default 'error'
    constraint operational_events_severity_check
    check (severity in ('warning', 'error', 'critical')),
  bucket text,
  route text,
  actor_fingerprint text,
  record_fingerprint text,
  error_code text,
  error_status integer,
  occurred_at timestamptz not null default now(),
  constraint operational_events_event_check
    check (char_length(event) between 3 and 160 and event ~ '^[a-z0-9_.-]+$'),
  constraint operational_events_component_check
    check (char_length(component) between 2 and 80 and component ~ '^[a-z0-9_.-]+$'),
  constraint operational_events_operation_check
    check (char_length(operation) between 2 and 100 and operation ~ '^[a-z0-9_.-]+$'),
  constraint operational_events_bucket_check
    check (bucket is null or (char_length(bucket) between 1 and 100 and bucket ~ '^[a-z0-9_.-]+$')),
  constraint operational_events_route_check
    check (route is null or (char_length(route) between 1 and 240 and left(route, 1) = '/' and route !~ '[[:cntrl:]]')),
  constraint operational_events_actor_fingerprint_check
    check (actor_fingerprint is null or actor_fingerprint ~ '^[0-9a-f]{16}$'),
  constraint operational_events_record_fingerprint_check
    check (record_fingerprint is null or record_fingerprint ~ '^[0-9a-f]{16}$'),
  constraint operational_events_error_code_check
    check (error_code is null or (char_length(error_code) between 1 and 120 and error_code !~ '[[:cntrl:]]')),
  constraint operational_events_error_status_check
    check (error_status is null or error_status between 100 and 599)
);

alter table app_private.operational_events enable row level security;
revoke all on app_private.operational_events from public, anon, authenticated;

create index idx_operational_events_occurred_at
  on app_private.operational_events(occurred_at desc);
create index idx_operational_events_event_occurred_at
  on app_private.operational_events(event, occurred_at desc);
create index idx_operational_events_component_occurred_at
  on app_private.operational_events(component, occurred_at desc);

create or replace function public.record_operational_event(
  p_event text,
  p_component text,
  p_operation text,
  p_severity text default 'error',
  p_bucket text default null,
  p_route text default null,
  p_actor_fingerprint text default null,
  p_record_fingerprint text default null,
  p_error_code text default null,
  p_error_status integer default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event text := lower(btrim(coalesce(p_event, '')));
  v_component text := lower(btrim(coalesce(p_component, '')));
  v_operation text := lower(btrim(coalesce(p_operation, '')));
  v_severity text := lower(btrim(coalesce(p_severity, 'error')));
  v_bucket text := nullif(lower(btrim(coalesce(p_bucket, ''))), '');
  v_route text := nullif(btrim(coalesce(p_route, '')), '');
  v_actor_fingerprint text := nullif(lower(btrim(coalesce(p_actor_fingerprint, ''))), '');
  v_record_fingerprint text := nullif(lower(btrim(coalesce(p_record_fingerprint, ''))), '');
  v_error_code text := nullif(left(btrim(coalesce(p_error_code, '')), 120), '');
  v_id uuid;
begin
  if v_event !~ '^[a-z0-9_.-]{3,160}$' then
    raise exception 'invalid_operational_event' using errcode = '22023';
  end if;
  if v_component !~ '^[a-z0-9_.-]{2,80}$' then
    raise exception 'invalid_operational_component' using errcode = '22023';
  end if;
  if v_operation !~ '^[a-z0-9_.-]{2,100}$' then
    raise exception 'invalid_operational_operation' using errcode = '22023';
  end if;
  if v_severity not in ('warning', 'error', 'critical') then
    raise exception 'invalid_operational_severity' using errcode = '22023';
  end if;
  if v_bucket is not null and v_bucket !~ '^[a-z0-9_.-]{1,100}$' then
    raise exception 'invalid_operational_bucket' using errcode = '22023';
  end if;
  if v_route is not null and (char_length(v_route) > 240 or left(v_route, 1) <> '/' or v_route ~ '[[:cntrl:]]') then
    raise exception 'invalid_operational_route' using errcode = '22023';
  end if;
  if v_actor_fingerprint is not null and v_actor_fingerprint !~ '^[0-9a-f]{16}$' then
    raise exception 'invalid_operational_actor_fingerprint' using errcode = '22023';
  end if;
  if v_record_fingerprint is not null and v_record_fingerprint !~ '^[0-9a-f]{16}$' then
    raise exception 'invalid_operational_record_fingerprint' using errcode = '22023';
  end if;
  if v_error_code is not null and v_error_code ~ '[[:cntrl:]]' then
    raise exception 'invalid_operational_error_code' using errcode = '22023';
  end if;
  if p_error_status is not null and (p_error_status < 100 or p_error_status > 599) then
    raise exception 'invalid_operational_error_status' using errcode = '22023';
  end if;

  -- Enforce bounded retention opportunistically on every write. This avoids a
  -- separate privileged cron dependency while event volume is still modest.
  delete from app_private.operational_events
  where occurred_at < now() - interval '30 days';

  insert into app_private.operational_events(
    event,
    component,
    operation,
    severity,
    bucket,
    route,
    actor_fingerprint,
    record_fingerprint,
    error_code,
    error_status
  ) values (
    v_event,
    v_component,
    v_operation,
    v_severity,
    v_bucket,
    v_route,
    v_actor_fingerprint,
    v_record_fingerprint,
    v_error_code,
    p_error_status
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.operational_event_health(
  p_window_minutes integer default 15,
  p_threshold integer default 5
)
returns table(
  status text,
  failing_event text,
  failing_component text,
  failure_count bigint,
  window_minutes integer,
  threshold integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_window integer := least(greatest(coalesce(p_window_minutes, 15), 5), 1440);
  v_threshold integer := least(greatest(coalesce(p_threshold, 5), 2), 1000);
  v_event text;
  v_component text;
  v_count bigint;
begin
  select oe.event, oe.component, count(*)
  into v_event, v_component, v_count
  from app_private.operational_events oe
  where oe.occurred_at >= now() - make_interval(mins => v_window)
    and oe.severity in ('error', 'critical')
  group by oe.event, oe.component
  having count(*) >= v_threshold
  order by count(*) desc, oe.event
  limit 1;

  return query
  select
    case when v_event is null then 'ok'::text else 'degraded'::text end,
    v_event,
    v_component,
    coalesce(v_count, 0::bigint),
    v_window,
    v_threshold;
end;
$$;

revoke all on function public.record_operational_event(text,text,text,text,text,text,text,text,text,integer)
  from public, anon, authenticated;
grant execute on function public.record_operational_event(text,text,text,text,text,text,text,text,text,integer)
  to service_role;

revoke all on function public.operational_event_health(integer,integer)
  from public, anon, authenticated;
grant execute on function public.operational_event_health(integer,integer)
  to service_role;

commit;
