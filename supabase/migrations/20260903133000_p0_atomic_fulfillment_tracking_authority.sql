-- EntizNetStore P0 — atomic seller fulfillment + buyer tracking authority.
-- Delivery is a fulfillment fact only. Escrow remains held until the separate,
-- provider-confirmed payout ledger releases it.

begin;

create schema if not exists app_private;

create table public.order_fulfillment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  from_status text not null,
  to_status text not null,
  fulfillment_status text not null,
  actor_id uuid not null,
  shipping_carrier text,
  tracking_number text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint order_fulfillment_events_transition_check check (
    (from_status = 'confirmed' and to_status = 'processing')
    or (from_status = 'processing' and to_status = 'shipped')
    or (from_status = 'shipped' and to_status = 'delivered')
  ),
  constraint order_fulfillment_events_fulfillment_status_check
    check (fulfillment_status in ('unfulfilled', 'partial', 'fulfilled')),
  constraint order_fulfillment_events_carrier_check check (
    shipping_carrier is null
    or (char_length(shipping_carrier) between 1 and 100 and shipping_carrier !~ '[[:cntrl:]]')
  ),
  constraint order_fulfillment_events_tracking_check check (
    tracking_number is null
    or (char_length(tracking_number) between 1 and 200 and tracking_number !~ '[[:cntrl:]]')
  ),
  constraint order_fulfillment_events_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),
  unique (order_id, to_status)
);

create index idx_order_fulfillment_events_order_time
  on public.order_fulfillment_events(order_id, occurred_at, id);

alter table public.order_fulfillment_events enable row level security;

create policy order_fulfillment_events_participant_select
on public.order_fulfillment_events
for select to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_fulfillment_events.order_id
      and (o.buyer_id = (select auth.uid()) or o.seller_id = (select auth.uid()))
  )
);

revoke all on table public.order_fulfillment_events from public, anon, authenticated;
grant select on table public.order_fulfillment_events to authenticated;
grant select, insert, update, delete on table public.order_fulfillment_events to service_role;

create or replace function app_private.reject_order_fulfillment_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'order_fulfillment_events_are_immutable' using errcode = '55000';
end;
$$;

create trigger trg_order_fulfillment_events_immutable
before update or delete on public.order_fulfillment_events
for each row execute function app_private.reject_order_fulfillment_event_mutation();

create or replace function app_private.transition_seller_order_authoritative(
  p_order_id uuid,
  p_next_status text,
  p_tracking_number text default null,
  p_shipping_carrier text default null
)
returns table(
  order_status text,
  order_fulfillment_status text,
  fulfillment_event_id uuid,
  canonical_shipping_carrier text,
  canonical_tracking_number text,
  canonical_shipped_at timestamptz,
  canonical_delivered_at timestamptz,
  idempotent boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.orders%rowtype;
  v_from_status text;
  v_next_status text := lower(btrim(coalesce(p_next_status, '')));
  v_tracking text := nullif(btrim(coalesce(p_tracking_number, '')), '');
  v_carrier text := nullif(btrim(coalesce(p_shipping_carrier, '')), '');
  v_event_id uuid;
  v_notification_type text;
  v_notification_title text;
  v_notification_message text;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_order_id is null or v_next_status not in ('processing', 'shipped', 'delivered') then
    raise exception 'invalid_fulfillment_transition' using errcode = '22023';
  end if;
  if v_tracking is not null and (char_length(v_tracking) > 200 or v_tracking ~ '[[:cntrl:]]') then
    raise exception 'invalid_tracking_number' using errcode = '22023';
  end if;
  if v_carrier is not null and (char_length(v_carrier) > 100 or v_carrier ~ '[[:cntrl:]]') then
    raise exception 'invalid_shipping_carrier' using errcode = '22023';
  end if;

  select * into v_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found or v_order.seller_id is distinct from v_actor then
    raise exception 'order_not_found_or_not_owned' using errcode = '42501';
  end if;
  if v_order.payment_status <> 'paid' then
    raise exception 'only_paid_orders_can_be_fulfilled' using errcode = '22023';
  end if;

  -- Safe retry after a lost HTTP response. The order lock serializes concurrent
  -- identical requests; only the first request creates the event + notification.
  if v_order.status = v_next_status then
    if v_next_status = 'shipped' and (
      (v_tracking is not null and v_tracking is distinct from v_order.tracking_number)
      or (v_carrier is not null and v_carrier is distinct from v_order.shipping_carrier)
    ) then
      raise exception 'conflicting_tracking_retry' using errcode = '22023';
    end if;

    select e.id into v_event_id
    from public.order_fulfillment_events e
    where e.order_id = p_order_id and e.to_status = v_next_status;

    return query select
      v_order.status,
      v_order.fulfillment_status,
      v_event_id,
      v_order.shipping_carrier,
      v_order.tracking_number,
      v_order.shipped_at,
      v_order.delivered_at,
      true;
    return;
  end if;

  v_from_status := v_order.status;

  if v_next_status = 'processing' and v_order.status = 'confirmed' then
    update public.orders
    set status = 'processing', updated_at = now()
    where id = p_order_id;

    v_notification_type := 'order';
    v_notification_title := 'Order is being processed';
    v_notification_message := 'Your order ' || v_order.order_number || ' is being prepared by the seller.';

  elsif v_next_status = 'shipped' and v_order.status = 'processing' then
    if v_tracking is null or v_carrier is null then
      raise exception 'carrier_and_tracking_required' using errcode = '22023';
    end if;

    update public.orders
    set status = 'shipped',
        fulfillment_status = 'partial',
        tracking_number = v_tracking,
        shipping_carrier = v_carrier,
        shipped_at = now(),
        updated_at = now()
    where id = p_order_id;

    update public.order_items
    set fulfillment_status = 'fulfilled'
    where order_id = p_order_id
      and coalesce(requires_shipping, true)
      and fulfillment_status <> 'fulfilled';

    v_notification_type := 'shipping';
    v_notification_title := 'Order shipped';
    v_notification_message := 'Your order ' || v_order.order_number || ' has shipped with ' || v_carrier || '.';

  elsif v_next_status = 'delivered' and v_order.status = 'shipped' then
    update public.orders
    set status = 'delivered',
        fulfillment_status = 'fulfilled',
        delivered_at = now(),
        updated_at = now()
    where id = p_order_id;

    update public.order_items
    set fulfillment_status = 'fulfilled'
    where order_id = p_order_id
      and fulfillment_status <> 'fulfilled';

    v_notification_type := 'shipping';
    v_notification_title := 'Order delivered';
    v_notification_message := 'Your order ' || v_order.order_number || ' is marked as delivered.';

  else
    raise exception 'invalid_fulfillment_transition' using errcode = '22023';
  end if;

  select * into v_order
  from public.orders o
  where o.id = p_order_id;

  insert into public.order_fulfillment_events(
    order_id,
    from_status,
    to_status,
    fulfillment_status,
    actor_id,
    shipping_carrier,
    tracking_number,
    metadata,
    occurred_at
  ) values (
    p_order_id,
    v_from_status,
    v_order.status,
    v_order.fulfillment_status,
    v_actor,
    v_order.shipping_carrier,
    v_order.tracking_number,
    jsonb_build_object('authority_version', 1),
    now()
  )
  returning id into v_event_id;

  -- Notification is part of the same database transaction. If this write or the
  -- event write fails, Postgres rolls the order + item mutation back as well.
  insert into public.notifications(
    user_id,
    type,
    title,
    message,
    read,
    action_url,
    metadata,
    created_at,
    updated_at
  ) values (
    v_order.buyer_id,
    v_notification_type,
    v_notification_title,
    v_notification_message,
    false,
    '/dashboard/buyer/orders',
    jsonb_strip_nulls(jsonb_build_object(
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'status', v_order.status,
      'shipping_carrier', v_order.shipping_carrier,
      'tracking_number', v_order.tracking_number,
      'fulfillment_event_id', v_event_id
    )),
    now(),
    now()
  );

  return query select
    v_order.status,
    v_order.fulfillment_status,
    v_event_id,
    v_order.shipping_carrier,
    v_order.tracking_number,
    v_order.shipped_at,
    v_order.delivered_at,
    false;
end;
$$;

revoke all on function app_private.transition_seller_order_authoritative(uuid,text,text,text)
  from public, anon;
grant execute on function app_private.transition_seller_order_authoritative(uuid,text,text,text)
  to authenticated, service_role;
grant usage on schema app_private to authenticated, service_role;

-- Replace the exposed privileged implementation with a thin invoker wrapper.
drop function public.transition_seller_order(uuid,text,text,text);
create function public.transition_seller_order(
  p_order_id uuid,
  p_next_status text,
  p_tracking_number text default null,
  p_shipping_carrier text default null
)
returns table(
  order_status text,
  order_fulfillment_status text,
  fulfillment_event_id uuid,
  canonical_shipping_carrier text,
  canonical_tracking_number text,
  canonical_shipped_at timestamptz,
  canonical_delivered_at timestamptz,
  idempotent boolean
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from app_private.transition_seller_order_authoritative(
    p_order_id,
    p_next_status,
    p_tracking_number,
    p_shipping_carrier
  );
$$;

revoke all on function public.transition_seller_order(uuid,text,text,text)
  from public, anon;
grant execute on function public.transition_seller_order(uuid,text,text,text)
  to authenticated, service_role;

commit;
