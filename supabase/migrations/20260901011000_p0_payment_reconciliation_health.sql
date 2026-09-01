-- P0 stale payment-initialization reconciliation health.
--
-- A durable initialization claim prevents duplicate processor calls, but a
-- worker can still crash after claiming the checkout and before attaching a
-- provider reference or persisting an explicit uncertainty marker. Detect such
-- unresolved claims without exposing payment/customer identifiers.

begin;

-- `/api/health` calls this authority on every readiness probe. Keep both
-- negative-path scans bounded to narrow active subsets so historical payment
-- volume cannot turn a public health probe into a full payment-table scan.
create index if not exists idx_payment_sessions_unbound_initialization_started
  on public.payment_sessions(payment_initialization_started_at)
  where payment_initialization_attempt_id is not null
    and payment_provider is null
    and provider_payment_id is null
    and stripe_payment_intent_id is null
    and status in ('pending', 'requires_payment');

create index if not exists idx_payment_sessions_uncertain_initialization_started
  on public.payment_sessions(payment_initialization_started_at)
  where payment_initialization_attempt_id is not null
    and payment_initialization_started_at is not null
    and status in ('pending', 'requires_payment')
    and metadata @> '{"payment_initialization_uncertain": true}'::jsonb;

create or replace function public.service_payment_reconciliation_health(
  p_stale_minutes integer default 10
)
returns table(
  status text,
  stale_unbound_claim_count bigint,
  uncertain_claim_count bigint,
  stale_minutes integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_stale_minutes integer := least(greatest(coalesce(p_stale_minutes, 10), 5), 1440);
  v_stale_unbound bigint;
  v_uncertain bigint;
begin
  select count(*)
  into v_uncertain
  from public.payment_sessions ps
  where ps.status in ('pending', 'requires_payment')
    and ps.payment_initialization_attempt_id is not null
    and ps.payment_initialization_started_at is not null
    and ps.metadata @> '{"payment_initialization_uncertain": true}'::jsonb;

  select count(*)
  into v_stale_unbound
  from public.payment_sessions ps
  where ps.status in ('pending', 'requires_payment')
    and ps.payment_initialization_attempt_id is not null
    and ps.payment_initialization_started_at is not null
    and ps.payment_initialization_started_at <= now() - make_interval(mins => v_stale_minutes)
    and ps.payment_provider is null
    and ps.provider_payment_id is null
    and ps.stripe_payment_intent_id is null
    and not (ps.metadata @> '{"payment_initialization_uncertain": true}'::jsonb);

  return query
  select
    case when v_uncertain > 0 or v_stale_unbound > 0 then 'degraded'::text else 'ok'::text end,
    v_stale_unbound,
    v_uncertain,
    v_stale_minutes;
end;
$$;

revoke all on function public.service_payment_reconciliation_health(integer)
  from public, anon, authenticated;
grant execute on function public.service_payment_reconciliation_health(integer)
  to service_role;

comment on function public.service_payment_reconciliation_health(integer) is
  'Service-only bounded readiness signal for unresolved payment initialization claims. Returns counts to trusted server authority only; public health must expose status only.';

commit;
