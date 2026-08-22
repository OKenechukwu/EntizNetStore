-- Harden provider-neutral terminal payment states against out-of-order events.
-- Once a checkout is failed/cancelled, later non-success callbacks are audited
-- and ignored rather than reopening it. A later success remains an incident and
-- is rejected because inventory may already have been released.

create or replace function public.finalize_checkout_payment_v2(
  p_event_id text,
  p_event_type text,
  p_session_id uuid,
  p_provider text,
  p_provider_payment_id text,
  p_outcome text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_provider text := lower(btrim(p_provider));
  v_payment_id text := btrim(p_provider_payment_id);
  v_outcome text := lower(btrim(p_outcome));
  v_event_key text;
  v_session public.payment_sessions%rowtype;
  v_res record;
  v_order record;
  v_fee bigint;
begin
  if v_provider !~ '^[a-z0-9][a-z0-9_-]{1,31}$'
     or nullif(btrim(p_event_id), '') is null
     or nullif(btrim(p_event_type), '') is null
     or nullif(v_payment_id, '') is null then
    raise exception 'Provider, event and payment identifiers are required'
      using errcode = '22023';
  end if;

  if v_outcome not in ('succeeded', 'retryable_failure', 'terminal_failure', 'cancelled') then
    raise exception 'Unsupported normalized payment outcome' using errcode = '22023';
  end if;

  select * into v_session
  from public.payment_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Checkout session not found' using errcode = '22023';
  end if;

  if v_session.payment_provider is distinct from v_provider
     or v_session.provider_payment_id is distinct from v_payment_id then
    raise exception 'Provider payment reference does not match checkout session'
      using errcode = '22023';
  end if;

  v_event_key := v_provider || ':' || btrim(p_event_id);

  insert into public.payment_webhook_events(
    event_id,
    event_type,
    payment_session_id,
    provider
  )
  values (v_event_key, btrim(p_event_type), p_session_id, v_provider)
  on conflict do nothing;

  if not found then
    return false;
  end if;

  -- Paid is terminal. We still record a distinct late provider event above for
  -- reconciliation/audit, but it can never downgrade commerce state.
  if v_session.status = 'paid' then
    return true;
  end if;

  -- Failed/cancelled are terminal once inventory has been released. Retryable
  -- or additional terminal callbacks are harmless no-ops. A late success is a
  -- reconciliation incident and must not accept money against released stock.
  if v_session.status in ('failed', 'cancelled') then
    if v_outcome = 'succeeded' then
      raise exception 'Checkout session is no longer payable';
    end if;
    return true;
  end if;

  if v_outcome = 'succeeded' then
    if exists (
      select 1 from public.inventory_reservations r
      where r.payment_session_id = p_session_id
        and r.status = 'pending'
        and r.expires_at <= now()
    ) then
      raise exception 'Checkout inventory reservation expired before payment confirmation';
    end if;

    if not exists (
      select 1 from public.inventory_reservations r
      where r.payment_session_id = p_session_id
        and r.status = 'pending'
    ) then
      raise exception 'Checkout has no consumable inventory reservation';
    end if;

    for v_res in
      select * from public.inventory_reservations
      where payment_session_id = p_session_id and status = 'pending'
      for update
    loop
      update public.product_variants
      set inventory_quantity = case
            when track_inventory then inventory_quantity - v_res.quantity
            else inventory_quantity
          end,
          updated_at = now()
      where id = v_res.variant_id
        and (
          not track_inventory
          or inventory_policy = 'continue'
          or inventory_quantity >= v_res.quantity
        );

      if not found then
        raise exception 'Reserved inventory is no longer available';
      end if;

      update public.inventory_reservations
      set status = 'consumed', updated_at = now()
      where id = v_res.id;
    end loop;

    update public.payment_sessions
    set status = 'paid',
        metadata = metadata - 'last_payment_failure',
        updated_at = now()
    where id = p_session_id;

    update public.orders
    set status = 'confirmed', payment_status = 'paid', updated_at = now()
    where payment_session_id = p_session_id;

    for v_order in
      select * from public.orders where payment_session_id = p_session_id
    loop
      v_fee := round(v_order.total_cents * 0.10);

      insert into public.escrow_transactions(order_id, seller_id, amount_cents, status)
      values (v_order.id, v_order.seller_id, v_order.total_cents - v_fee, 'held')
      on conflict (order_id) do nothing;

      update public.orders
      set metadata = metadata || jsonb_build_object('platform_fee_cents', v_fee)
      where id = v_order.id;
    end loop;

  elsif v_outcome = 'retryable_failure' then
    update public.payment_sessions
    set status = 'requires_payment',
        metadata = jsonb_set(
          metadata,
          '{last_payment_failure}',
          jsonb_build_object(
            'provider', v_provider,
            'event_id', btrim(p_event_id),
            'recorded_at', now()
          ),
          true
        ),
        updated_at = now()
    where id = p_session_id;

  else
    update public.payment_sessions
    set status = case when v_outcome = 'cancelled' then 'cancelled' else 'failed' end,
        metadata = jsonb_set(
          metadata,
          '{terminal_payment_event}',
          jsonb_build_object(
            'provider', v_provider,
            'event_id', btrim(p_event_id),
            'outcome', v_outcome,
            'recorded_at', now()
          ),
          true
        ),
        updated_at = now()
    where id = p_session_id;

    update public.inventory_reservations
    set status = 'released', updated_at = now()
    where payment_session_id = p_session_id and status = 'pending';

    update public.orders
    set status = 'cancelled', payment_status = 'failed', updated_at = now()
    where payment_session_id = p_session_id and payment_status = 'pending';
  end if;

  return true;
end;
$$;

revoke all on function public.finalize_checkout_payment_v2(text, text, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.finalize_checkout_payment_v2(text, text, uuid, text, text, text)
  to service_role;
