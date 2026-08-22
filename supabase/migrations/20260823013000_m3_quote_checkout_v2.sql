-- EntizNetStore M3 — trusted cart quote -> checkout/order snapshot boundary.
-- The browser no longer chooses an arbitrary checkout item array/address once
-- this migration and its application route are released together.

begin;

alter table public.cart_quotes
  add column if not exists seller_totals jsonb not null default '{}'::jsonb;

alter table public.cart_quotes
  drop constraint if exists cart_quotes_items_snapshot_array_check;
alter table public.cart_quotes
  add constraint cart_quotes_items_snapshot_array_check
  check (jsonb_typeof(items_snapshot) = 'array');

alter table public.cart_quotes
  drop constraint if exists cart_quotes_seller_totals_object_check;
alter table public.cart_quotes
  add constraint cart_quotes_seller_totals_object_check
  check (jsonb_typeof(seller_totals) = 'object');

create or replace function public.create_checkout_session_v2(
  p_cart_id uuid,
  p_quote_id uuid,
  p_idempotency_key uuid
)
returns table(session_id uuid, amount_cents bigint)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_buyer_id uuid := auth.uid();
  v_cart public.carts%rowtype;
  v_quote public.cart_quotes%rowtype;
  v_session_id uuid;
  v_existing_status text;
  v_existing_metadata jsonb;
  v_item jsonb;
  v_product record;
  v_variant record;
  v_order_id uuid;
  v_qty integer;
  v_reserved integer;
  v_unit_price bigint;
  v_line_total bigint;
  v_snapshot_line bigint;
  v_snapshot_seller uuid;
  v_seller_entry record;
  v_seller_uuid uuid;
  v_seller_subtotal bigint;
  v_seller_tax bigint;
  v_seller_shipping bigint;
  v_seller_discount bigint;
  v_seller_total bigint;
  v_order_total_sum bigint;
begin
  if v_buyer_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_cart_id is null or p_quote_id is null or p_idempotency_key is null then
    raise exception 'cart_quote_and_idempotency_required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles_buyer where id = v_buyer_id) then
    raise exception 'buyer_profile_required' using errcode = '42501';
  end if;

  -- Resolve idempotent replays before requiring the quote to remain ready. A
  -- consumed quote may be replayed only with the same key/cart/quote tuple.
  select ps.id, ps.amount_cents, ps.status, ps.metadata
    into v_session_id, amount_cents, v_existing_status, v_existing_metadata
  from public.payment_sessions ps
  where ps.buyer_id = v_buyer_id
    and ps.idempotency_key = p_idempotency_key
  for update;

  if v_session_id is not null then
    if v_existing_metadata->>'cart_id' is distinct from p_cart_id::text
       or v_existing_metadata->>'quote_id' is distinct from p_quote_id::text then
      raise exception 'idempotency_key_already_used_for_different_checkout'
        using errcode = '22023';
    end if;
    if v_existing_status in ('failed', 'cancelled') then
      raise exception 'checkout_session_no_longer_payable' using errcode = '22023';
    end if;
    if v_existing_status in ('pending', 'requires_payment')
       and exists (
         select 1 from public.inventory_reservations r
         where r.payment_session_id = v_session_id
           and r.status = 'pending'
           and r.expires_at <= now()
       ) then
      raise exception 'checkout_session_expired' using errcode = '22023';
    end if;
    return query select v_session_id, amount_cents;
    return;
  end if;

  select * into v_cart
  from public.carts
  where id = p_cart_id
    and buyer_id = v_buyer_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'active_cart_not_found_or_access_denied' using errcode = '42501';
  end if;

  select * into v_quote
  from public.cart_quotes
  where id = p_quote_id
    and cart_id = p_cart_id
    and buyer_id = v_buyer_id
  for update;

  if not found then
    raise exception 'cart_quote_not_found_or_access_denied' using errcode = '42501';
  end if;
  if v_quote.status <> 'ready' then
    raise exception 'cart_quote_not_ready' using errcode = '22023';
  end if;
  if v_quote.expires_at <= now() then
    update public.cart_quotes set status = 'expired' where id = p_quote_id;
    raise exception 'cart_quote_expired' using errcode = '22023';
  end if;
  if v_quote.cart_version <> v_cart.version then
    raise exception 'cart_quote_stale' using errcode = '22023';
  end if;
  if jsonb_array_length(v_quote.items_snapshot) < 1
     or jsonb_array_length(v_quote.items_snapshot) > 100 then
    raise exception 'invalid_cart_quote_items' using errcode = '22023';
  end if;

  insert into public.payment_sessions(
    buyer_id,
    idempotency_key,
    shipping_address,
    amount_cents,
    metadata
  ) values (
    v_buyer_id,
    p_idempotency_key,
    v_quote.shipping_address,
    v_quote.total_cents,
    jsonb_build_object(
      'cart_id', p_cart_id,
      'quote_id', p_quote_id,
      'cart_version', v_quote.cart_version,
      'items_snapshot', v_quote.items_snapshot,
      'seller_totals', v_quote.seller_totals,
      'quote_subtotal_cents', v_quote.subtotal_cents,
      'quote_tax_cents', v_quote.tax_cents,
      'quote_shipping_cents', v_quote.shipping_cents,
      'quote_discount_cents', v_quote.discount_cents,
      'marketplace_brand', 'entiznetstore'
    )
  )
  returning id into v_session_id;

  for v_item in select value from jsonb_array_elements(v_quote.items_snapshot) loop
    begin
      v_qty := (v_item->>'quantity')::integer;
      v_snapshot_seller := (v_item->>'sellerId')::uuid;
      v_snapshot_line := (v_item->>'lineTotalCents')::bigint;
    exception when others then
      raise exception 'invalid_cart_quote_item_snapshot' using errcode = '22023';
    end;

    if v_qty < 1 or v_qty > 100 then
      raise exception 'invalid_item_quantity' using errcode = '22023';
    end if;

    select p.id,
           p.seller_id,
           p.title,
           p.requires_shipping,
           p.is_taxable,
           p.marketplace_brand
      into v_product
    from public.products p
    join public.profiles_seller s on s.id = p.seller_id
    where p.id = (v_item->>'productId')::uuid
      and p.status = 'active'
      and p.moderation_status = 'approved'
      and s.verification_status = 'verified';

    if v_product.id is null or v_product.seller_id <> v_snapshot_seller then
      raise exception 'quoted_product_unavailable_or_changed' using errcode = '22023';
    end if;
    if v_product.requires_shipping and v_quote.shipping_address is null then
      raise exception 'shipping_address_required' using errcode = '22023';
    end if;

    select pv.id,
           pv.title,
           pv.sku,
           pv.price,
           pv.inventory_quantity,
           pv.inventory_policy,
           pv.track_inventory
      into v_variant
    from public.product_variants pv
    where pv.id = (v_item->>'variantId')::uuid
      and pv.product_id = v_product.id
      and pv.is_active
    for update;

    if v_variant.id is null then
      raise exception 'quoted_variant_unavailable' using errcode = '22023';
    end if;

    v_unit_price := round(v_variant.price * 100)::bigint;
    v_line_total := v_unit_price * v_qty;
    if v_unit_price <> (v_item->>'unitPriceCents')::bigint
       or v_line_total <> v_snapshot_line then
      raise exception 'cart_quote_price_changed' using errcode = '22023';
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
      raise exception 'insufficient_inventory' using errcode = '22023';
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
        tax_cents,
        shipping_cents,
        discount_cents,
        total_cents,
        payment_status,
        fulfillment_status,
        shipping_address,
        payment_session_id,
        metadata
      ) values (
        'ENS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
        v_buyer_id,
        v_product.seller_id,
        'pending',
        0, 0, 0, 0, 0,
        'pending',
        'unfulfilled',
        v_quote.shipping_address,
        v_session_id,
        jsonb_build_object(
          'marketplace_brand', 'entiznetstore',
          'cart_id', p_cart_id,
          'quote_id', p_quote_id,
          'cart_version', v_quote.cart_version
        )
      ) returning id into v_order_id;
    end if;

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
    ) values (
      v_order_id,
      v_product.id,
      v_variant.id,
      v_qty,
      v_unit_price,
      v_line_total,
      coalesce(nullif(v_item->>'title', ''), v_product.title),
      nullif(v_item->>'variantTitle', ''),
      nullif(v_item->>'sku', ''),
      v_product.requires_shipping,
      not v_product.requires_shipping
    );

    update public.orders
    set subtotal_cents = subtotal_cents + v_line_total,
        total_cents = total_cents + v_line_total,
        updated_at = now()
    where id = v_order_id;

    insert into public.inventory_reservations(
      payment_session_id,
      product_id,
      variant_id,
      quantity
    ) values (v_session_id, v_product.id, v_variant.id, v_qty);
  end loop;

  for v_seller_entry in select key, value from jsonb_each(v_quote.seller_totals) loop
    begin
      v_seller_uuid := v_seller_entry.key::uuid;
      v_seller_subtotal := coalesce((v_seller_entry.value->>'subtotalCents')::bigint, 0);
      v_seller_tax := coalesce((v_seller_entry.value->>'taxCents')::bigint, 0);
      v_seller_shipping := coalesce((v_seller_entry.value->>'shippingCents')::bigint, 0);
      v_seller_discount := coalesce((v_seller_entry.value->>'discountCents')::bigint, 0);
      v_seller_total := coalesce((v_seller_entry.value->>'totalCents')::bigint, 0);
    exception when others then
      raise exception 'invalid_seller_total_snapshot' using errcode = '22023';
    end;

    if v_seller_total <> v_seller_subtotal + v_seller_tax + v_seller_shipping - v_seller_discount
       or v_seller_subtotal < 0 or v_seller_tax < 0 or v_seller_shipping < 0
       or v_seller_discount < 0 or v_seller_total < 0 then
      raise exception 'invalid_seller_total_math' using errcode = '22023';
    end if;

    update public.orders
    set tax_cents = v_seller_tax,
        shipping_cents = v_seller_shipping,
        discount_cents = v_seller_discount,
        total_cents = v_seller_total,
        updated_at = now()
    where payment_session_id = v_session_id
      and seller_id = v_seller_uuid
      and subtotal_cents = v_seller_subtotal;

    if not found then
      raise exception 'seller_total_does_not_match_checkout_items' using errcode = '22023';
    end if;
  end loop;

  if exists (
    select 1 from public.orders o
    where o.payment_session_id = v_session_id
      and not (v_quote.seller_totals ? o.seller_id::text)
  ) then
    raise exception 'missing_seller_total_snapshot' using errcode = '22023';
  end if;

  select coalesce(sum(o.total_cents), 0)::bigint into v_order_total_sum
  from public.orders o where o.payment_session_id = v_session_id;

  if v_order_total_sum <> v_quote.total_cents then
    raise exception 'quote_order_total_mismatch' using errcode = '22023';
  end if;

  update public.cart_quotes
  set status = 'consumed', consumed_at = now()
  where id = p_quote_id and status = 'ready';

  if not found then
    raise exception 'cart_quote_already_consumed';
  end if;

  return query select v_session_id, v_quote.total_cents;
end;
$$;

-- The old arbitrary item/address RPC remains available only to trusted workers
-- for historical compatibility/testing. Authenticated checkout must use v2.
revoke all on function public.create_checkout_session(jsonb,jsonb,uuid)
  from public, anon, authenticated;
grant execute on function public.create_checkout_session(jsonb,jsonb,uuid)
  to service_role;

revoke all on function public.create_checkout_session_v2(uuid,uuid,uuid)
  from public, anon;
grant execute on function public.create_checkout_session_v2(uuid,uuid,uuid)
  to authenticated, service_role;

-- Preserve the existing payment finalizer signature while adding M3 cart
-- conversion. Historical sessions without cart metadata are unchanged.
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
  v_cart_id uuid;
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
  ) values (v_event_key, btrim(p_event_type), p_session_id, v_provider)
  on conflict do nothing;

  if not found then return false; end if;
  if v_session.status = 'paid' then return true; end if;

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

    begin
      v_cart_id := nullif(v_session.metadata->>'cart_id', '')::uuid;
    exception when others then
      v_cart_id := null;
    end;

    if v_cart_id is not null then
      update public.carts
      set status = 'converted', updated_at = now()
      where id = v_cart_id
        and buyer_id = v_session.buyer_id
        and status = 'active';
    end if;

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

revoke all on function public.finalize_checkout_payment_v2(text,text,uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.finalize_checkout_payment_v2(text,text,uuid,text,text,text)
  to service_role;

commit;
