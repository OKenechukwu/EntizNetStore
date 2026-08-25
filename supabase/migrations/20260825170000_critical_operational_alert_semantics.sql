-- EntizNetStore — critical operational alert semantics.
-- Forward-only refinement of the operational health RPC introduced by
-- 20260825153000_operational_event_ledger.sql.
--
-- Ordinary operational errors still require the configured repetition
-- threshold. A single critical event represents a reconciliation/invariant
-- failure where money, identity or trust may already be inconsistent, so it
-- must degrade readiness immediately.

begin;

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
  -- Critical reconciliation/invariant failures page immediately. Prefer the
  -- newest critical event group so the readiness signal reflects the most
  -- recent actionable incident when several groups exist.
  select oe.event, oe.component, count(*)
  into v_event, v_component, v_count
  from app_private.operational_events oe
  where oe.occurred_at >= now() - make_interval(mins => v_window)
    and oe.severity = 'critical'
  group by oe.event, oe.component
  order by max(oe.occurred_at) desc, count(*) desc, oe.event
  limit 1;

  if v_event is null then
    -- Non-critical infrastructure errors need repetition to avoid alerting on
    -- an isolated transient failure.
    select oe.event, oe.component, count(*)
    into v_event, v_component, v_count
    from app_private.operational_events oe
    where oe.occurred_at >= now() - make_interval(mins => v_window)
      and oe.severity = 'error'
    group by oe.event, oe.component
    having count(*) >= v_threshold
    order by count(*) desc, max(oe.occurred_at) desc, oe.event
    limit 1;
  end if;

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

revoke all on function public.operational_event_health(integer,integer)
  from public, anon, authenticated;
grant execute on function public.operational_event_health(integer,integer)
  to service_role;

commit;
