-- Preserve the strict legacy Stripe RPC contract after introducing the
-- provider-neutral finalizer. Existing callers/tests must not be able to pair a
-- success boolean with a Stripe failure event type (or vice versa).

create or replace function public.finalize_checkout_payment(
  p_event_id text,
  p_event_type text,
  p_session_id uuid,
  p_payment_intent_id text,
  p_succeeded boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if (p_succeeded and p_event_type <> 'payment_intent.succeeded')
     or (not p_succeeded and p_event_type <> 'payment_intent.payment_failed') then
    raise exception 'Stripe event type/outcome mismatch' using errcode = '22023';
  end if;

  return public.finalize_checkout_payment_v2(
    p_event_id,
    p_event_type,
    p_session_id,
    'stripe',
    p_payment_intent_id,
    case when p_succeeded then 'succeeded' else 'retryable_failure' end
  );
end;
$$;

revoke all on function public.finalize_checkout_payment(text, text, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.finalize_checkout_payment(text, text, uuid, text, boolean)
  to service_role;
