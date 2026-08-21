-- EntizNetStore P0 commerce hardening.
--
-- Fixes two launch-blocking transaction-state defects:
-- 1. Concurrent retries of the same buyer idempotency key could collide on the
--    unique constraint instead of deterministically returning the first session.
-- 2. Stripe payment_failed / payment_intent.succeeded events may be delivered
--    more than once or out of order. A failure event must never downgrade a
--    paid checkout, and a transient payment failure must not release inventory
--    that a later successful retry of the same PaymentIntent still depends on.
--
-- Forward-only migration. Do not edit the earlier applied checkout migrations.

create or replace function public.create_checkout_session(
  p_items jsonb,
  p_shipping_address jsonb,
  p_idempotency_key uuid
)
returns table(session_id uuid, amount_cents bigint)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_buyer_id uuid := auth.uid();
  v_session_id uuid;
  v_existing_status text;
  v_existing_metadata jsonb;
  v_item jsonb;
  v_product record;
  v_variant record;
  v_order_id uuid;
  v_qty integer;
  v_reserved integer;
  v_line_total bigint;
  v_total bigint := 0;
begin
  if v_buyer_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles_buyer where id = v_buyer_id) then
    raise exception 'Buyer profile required' using errcode = '42501';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 100 then
    raise exception 'Cart must contain 1 to 100 items' using errcode = '22023';
  end if;

  -- The unique buyer/idempotency-key constraint is the concurrency arbiter.
  -- ON CONFLICT waits for a concurrent creator to finish, then we read and
  -- validate the durable session instead of surfacing a uniqueness error.
  insert into public.payment_sessions(
    buyer_id,
    idempotency_key,
    shipping_address,
    metadata
  )
  values (
    v_buyer_id,
    p_idempotency_key,
    p_shipping_address,
    jsonb_build_object('request_items', p_items)
  )
  on conflict (buyer_id, idempotency_key) do nothing
  returning id into v_session_id;

  if v_session_id is null then
    select ps.id, ps.amount_cents, ps.status, ps.metadata
      into v_session_id, v_total, v_existing_status, v_existing_metadata
    from public.payment_sessions ps
    where ps.buyer_id = v_buyer_id
      and ps.idempotency_key = p_idempotency_key
    for update;

    if v_session_id is null then
      raise exception 'Unable to resolve idempotent checkout session';
    end if;

    -- Reusing an idempotency key for a different cart is unsafe: the caller
    -- must generate a new key. Old sessions created before this migration may
    -- lack request_items; those remain retryable for forward compatibility.
    if v_existing_metadata ? 'request_items'
       and v_existing_metadata->'request_items' <> p_items then
      raise exception 'Idempotency key was already used for a different cart'
        using errcode = '22023';
    end if;

    if v_existing_status in ('failed', 'cancelled') then
      raise exception 'Checkout session is no longer payable'
        using errcode = '22023';
    end if;

    if v_existing_status in ('pending', 'requires_payment')
       and exists (
         select 1
         from public.inventory_reservations r
         where r.payment_session_id = v_session_id
           and r.status = 'pending'
           and r.expires_at <= now()
       ) then
      raise exception 'Checkout session expired; start a new checkout'
        using errcode = '22023';
    end if;

    return query select v_session_id, v_total;
    return;
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    begin
      v_qty := coalesce((v_item->>'quantity')::integer, 0);
    exception when invalid_text_representation then
      raise exception 'Invalid item quantity' using errcode = '22023';
    end;

    if v_qty < 1 or v_qty > 100 then
      raise exception 'Invalid item quantity' using errcode = '22023';
    end if;

    select p.id, p.seller_id, p.title, p.requires_shipping, p.marketplace_brand
      into v_product
    from public.products p
    join public.profiles_seller s on s.id = p.seller_id
    where p.id = (v_item->>'productId')::uuid
      and p.status = 'active'
      and s.verification_status = 'verified';

    if v_product.id is null then
      raise exception 'Product is unavailable' using errcode = '22023';
    end if;

    if v_product.requires_shipping and p_shipping_address is null then
      raise exception 'Shipping address is required' using errcode = '22023';
    end if;

    -- Lock the variant row before availability calculation. This serializes
    -- reservations for the same SKU and prevents two checkouts from both
    -- accepting the same last units.
    select pv.id,
           pv.title,
           pv.sku,
           pv.price,
           pv.inventory_quantity,
           pv.inventory_policy,
           pv.track_inventory
      into v_variant
    from public.product_variants pv
    where pv.product_id = v_product.id
      and pv.is_active
      and ((v_item->>'variantId') is null or pv.id = (v_item->>'variantId')::uuid)
    order by pv.position, pv.created_at
    limit 1
    for update;

    if v_variant.id is null then
      raise exception 'Product variant is unavailable' using errcode = '22023';
    end if;

    select coalesce(sum(r.quantity), 0)::integer
      into v_reserved
    from public.inventory_reservations r
    where r.variant_id = v_variant.id
      and r.status = 'pending'
      and r.expires_at > now();

    if v_variant.track_inventory
       and v_variant.inventory_policy = 'deny'
       and v_variant.inventory_quantity - v_reserved < v_qty then
      raise exception 'Insufficient inventory for %', v_product.title
        using errcode = '22023';
    end if;

    select id into v_order_id
    from public.orders
    where payment_session_id = v_session_id
      and seller_id = v_product.seller_id;

    if v_order_id is null then
      insert into public.orders(
        order_number,
        buyer_id,
        seller_id,
        status,
        subtotal_cents,
        total_cents,
        payment_status,
        fulfillment_status,
        shipping_address,
        payment_session_id,
        metadata
      )
      values (
        'ENS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
        v_buyer_id,
        v_product.seller_id,
        'pending',
        0,
        0,
        'pending',
        'unfulfilled',
        p_shipping_address,
        v_session_id,
        jsonb_build_object('marketplace_brand', 'entiznetstore')
      )
      returning id into v_order_id;
    end if;

    v_line_total := round(v_variant.price * 100)::bigint * v_qty;

    insert into public.order_items(
      order_id,
      product_id,
      variant_id,
      quantity,
      price_cents,
      total_cents,
      product_title,
      variant_title,
      sku,
      requires_shipping,
      is_digital
    )
    values (
      v_order_id,
      v_product.id,
      v_variant.id,
      v_qty,
      round(v_variant.price * 100)::bigint,
      v_line_total,
      v_product.title,
      v_variant.title,
      v_variant.sku,
      v_product.requires_shipping,
      not v_product.requires_shipping
    );

    update public.orders
    set subtotal_cents = subtotal_cents + v_line_total,
        total_cents = total_cents + v_line_total
    where id = v_order_id;

    insert into public.inventory_reservations(
      payment_session_id,
      product_id,
      variant_id,
      quantity
    )
    values (v_session_id, v_product.id, v_variant.id, v_qty);

    v_total := v_total + v_line_total;
  end loop;

  update public.payment_sessions
  set amount_cents = v_total,
      updated_at = now()
  where id = v_session_id;

  return query select v_session_id, v_total;
end;
$$;

create or replace function public.cancel_checkout_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.payment_sessions
  set status = 'cancelled',
      updated_at = now()
  where id = p_session_id
    and buyer_id = auth.uid()
    and status in ('pending', 'requires_payment');

  if not found then
    raise exception 'Checkout session not found or is no longer cancellable'
      using errcode = '42501';
  end if;

  update public.inventory_reservations
  set status = 'released',
      updated_at = now()
  where payment_session_id = p_session_id
    and status = 'pending';

  update public.orders
  set status = 'cancelled',
      payment_status = 'failed',
      updated_at = now()
  where payment_session_id = p_session_id
    and payment_status = 'pending';
end;
$$;

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
declare
  v_session public.payment_sessions%rowtype;
  v_res record;
  v_order record;
  v_fee bigint;
begin
  if nullif(btrim(p_event_id), '') is null
     or nullif(btrim(p_payment_intent_id), '') is null then
    raise exception 'Stripe event and PaymentIntent identifiers are required'
      using errcode = '22023';
  end if;

  if (p_succeeded and p_event_type <> 'payment_intent.succeeded')
     or (not p_succeeded and p_event_type <> 'payment_intent.payment_failed') then
    raise exception 'Stripe event type/outcome mismatch' using errcode = '22023';
  end if;

  select * into v_session
  from public.payment_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Checkout session not found' using errcode = '22023';
  end if;

  if v_session.stripe_payment_intent_id is distinct from p_payment_intent_id then
    raise exception 'Payment intent does not match checkout session'
      using errcode = '22023';
  end if;

  insert into public.payment_webhook_events(event_id, event_type, payment_session_id)
  values (p_event_id, p_event_type, p_session_id)
  on conflict do nothing;

  if not found then
    -- Exact Stripe event replay: already processed successfully.
    return false;
  end if;

  if p_succeeded then
    -- A later/duplicate success event is harmless once the checkout is paid.
    if v_session.status = 'paid' then
      return true;
    end if;

    -- Explicitly cancelled/terminal sessions cannot silently become paid. A
    -- webhook failure here is intentional: it creates an actionable commerce
    -- incident rather than accepting money without a valid reservation.
    if v_session.status in ('failed', 'cancelled') then
      raise exception 'Checkout session is no longer payable';
    end if;

    if exists (
      select 1
      from public.inventory_reservations r
      where r.payment_session_id = p_session_id
        and r.status = 'pending'
        and r.expires_at <= now()
    ) then
      raise exception 'Checkout inventory reservation expired before payment confirmation';
    end if;

    if not exists (
      select 1
      from public.inventory_reservations r
      where r.payment_session_id = p_session_id
        and r.status = 'pending'
    ) then
      raise exception 'Checkout has no consumable inventory reservation';
    end if;

    for v_res in
      select *
      from public.inventory_reservations
      where payment_session_id = p_session_id
        and status = 'pending'
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
      set status = 'consumed',
          updated_at = now()
      where id = v_res.id;
    end loop;

    update public.payment_sessions
    set status = 'paid',
        metadata = metadata - 'last_payment_failure',
        updated_at = now()
    where id = p_session_id;

    update public.orders
    set status = 'confirmed',
        payment_status = 'paid',
        updated_at = now()
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
  else
    -- payment_intent.payment_failed is not terminal in Stripe: the same
    -- PaymentIntent may later succeed after the customer retries. Preserve the
    -- reservation and pending orders. Critically, never downgrade a paid or
    -- explicitly cancelled session because Stripe events can arrive out of
    -- order.
    if v_session.status in ('paid', 'cancelled') then
      return true;
    end if;

    update public.payment_sessions
    set status = 'requires_payment',
        metadata = jsonb_set(
          metadata,
          '{last_payment_failure}',
          jsonb_build_object('event_id', p_event_id, 'recorded_at', now()),
          true
        ),
        updated_at = now()
    where id = p_session_id;
  end if;

  return true;
end;
$$;

-- Preserve the M0 execute allow-list after replacing the functions.
revoke all on function public.create_checkout_session(jsonb, jsonb, uuid)
  from public, anon;
revoke all on function public.cancel_checkout_session(uuid)
  from public, anon;
revoke all on function public.finalize_checkout_payment(text, text, uuid, text, boolean)
  from public, anon, authenticated;

grant execute on function public.create_checkout_session(jsonb, jsonb, uuid)
  to authenticated, service_role;
grant execute on function public.cancel_checkout_session(uuid)
  to authenticated, service_role;
grant execute on function public.finalize_checkout_payment(text, text, uuid, text, boolean)
  to service_role;
