create table public.payment_sessions (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles_buyer(id) on delete restrict,
  idempotency_key uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'requires_payment', 'paid', 'failed', 'cancelled')),
  currency text not null default 'usd' check (currency = 'usd'),
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  stripe_payment_intent_id text unique,
  shipping_address jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (buyer_id, idempotency_key)
);

alter table public.orders
  add column if not exists payment_session_id uuid references public.payment_sessions(id) on delete restrict;
create index if not exists idx_orders_payment_session on public.orders(payment_session_id);

create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  payment_session_id uuid not null references public.payment_sessions(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null default 'pending' check (status in ('pending', 'consumed', 'released')),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_inventory_reservations_available
  on public.inventory_reservations(variant_id, status, expires_at);

create table public.payment_webhook_events (
  event_id text primary key,
  event_type text not null,
  payment_session_id uuid references public.payment_sessions(id),
  processed_at timestamptz not null default now()
);

alter table public.payment_sessions enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.payment_webhook_events enable row level security;

create unique index if not exists idx_escrow_one_per_order
  on public.escrow_transactions(order_id);

create or replace function public.create_checkout_session(
  p_items jsonb,
  p_shipping_address jsonb,
  p_idempotency_key uuid
)
returns table(session_id uuid, amount_cents bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid := auth.uid();
  v_session_id uuid;
  v_item jsonb;
  v_product record;
  v_variant record;
  v_order_id uuid;
  v_qty integer;
  v_reserved integer;
  v_line_total bigint;
  v_total bigint := 0;
begin
  if v_buyer_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not exists (select 1 from profiles_buyer where id=v_buyer_id) then
    raise exception 'Buyer profile required' using errcode='42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception 'Cart must contain 1 to 100 items' using errcode='22023';
  end if;

  select id, payment_sessions.amount_cents into v_session_id, v_total
  from payment_sessions where buyer_id=v_buyer_id and idempotency_key=p_idempotency_key;
  if v_session_id is not null then return query select v_session_id, v_total; return; end if;

  insert into payment_sessions(buyer_id,idempotency_key,shipping_address)
  values(v_buyer_id,p_idempotency_key,p_shipping_address) returning id into v_session_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item->>'quantity')::integer,0);
    if v_qty < 1 or v_qty > 100 then raise exception 'Invalid item quantity' using errcode='22023'; end if;

    select p.id,p.seller_id,p.title,p.requires_shipping,p.marketplace_brand
      into v_product
    from products p join profiles_seller s on s.id=p.seller_id
    where p.id=(v_item->>'productId')::uuid and p.status='active' and s.verification_status='verified';
    if v_product.id is null then raise exception 'Product is unavailable' using errcode='22023'; end if;
    if v_product.requires_shipping and p_shipping_address is null then
      raise exception 'Shipping address is required' using errcode='22023';
    end if;

    select pv.id,pv.title,pv.sku,pv.price,pv.inventory_quantity,pv.inventory_policy,pv.track_inventory
      into v_variant
    from product_variants pv
    where pv.product_id=v_product.id and pv.is_active
      and ((v_item->>'variantId') is null or pv.id=(v_item->>'variantId')::uuid)
    order by pv.position,pv.created_at limit 1 for update;
    if v_variant.id is null then raise exception 'Product variant is unavailable' using errcode='22023'; end if;

    select coalesce(sum(r.quantity),0)::integer into v_reserved
    from inventory_reservations r
    where r.variant_id=v_variant.id and r.status='pending' and r.expires_at>now();
    if v_variant.track_inventory and v_variant.inventory_policy='deny'
       and v_variant.inventory_quantity-v_reserved < v_qty then
      raise exception 'Insufficient inventory for %', v_product.title using errcode='22023';
    end if;

    select id into v_order_id from orders
    where payment_session_id=v_session_id and seller_id=v_product.seller_id;
    if v_order_id is null then
      insert into orders(order_number,buyer_id,seller_id,status,subtotal_cents,total_cents,
        payment_status,fulfillment_status,shipping_address,payment_session_id,metadata)
      values('ENS-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),v_buyer_id,
        v_product.seller_id,'pending',0,0,'pending','unfulfilled',p_shipping_address,v_session_id,
        jsonb_build_object('marketplace_brand','entiznetstore')) returning id into v_order_id;
    end if;

    v_line_total := round(v_variant.price*100)::bigint*v_qty;
    insert into order_items(order_id,product_id,variant_id,quantity,price_cents,total_cents,
      product_title,variant_title,sku,requires_shipping,is_digital)
    values(v_order_id,v_product.id,v_variant.id,v_qty,round(v_variant.price*100)::bigint,
      v_line_total,v_product.title,v_variant.title,v_variant.sku,v_product.requires_shipping,not v_product.requires_shipping);
    update orders set subtotal_cents=subtotal_cents+v_line_total,total_cents=total_cents+v_line_total where id=v_order_id;
    insert into inventory_reservations(payment_session_id,product_id,variant_id,quantity)
    values(v_session_id,v_product.id,v_variant.id,v_qty);
    v_total := v_total+v_line_total;
  end loop;

  update payment_sessions set amount_cents=v_total,updated_at=now() where id=v_session_id;
  return query select v_session_id,v_total;
end;
$$;

create or replace function public.attach_checkout_payment_intent(p_session_id uuid,p_payment_intent_id text)
returns void language plpgsql security definer set search_path=public as $$
begin
  update payment_sessions set stripe_payment_intent_id=p_payment_intent_id,status='requires_payment',updated_at=now()
  where id=p_session_id and buyer_id=auth.uid() and status in ('pending','requires_payment');
  if not found then raise exception 'Checkout session not found' using errcode='42501'; end if;
  update orders set payment_intent_id=p_payment_intent_id,updated_at=now() where payment_session_id=p_session_id;
end; $$;

create or replace function public.cancel_checkout_session(p_session_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update payment_sessions set status='failed',updated_at=now()
    where id=p_session_id and buyer_id=auth.uid() and status in ('pending','requires_payment');
  update inventory_reservations set status='released',updated_at=now()
    where payment_session_id=p_session_id and status='pending';
  update orders set status='cancelled',payment_status='failed',updated_at=now()
    where payment_session_id=p_session_id and payment_status='pending';
end; $$;

create or replace function public.finalize_checkout_payment(
  p_event_id text,p_event_type text,p_session_id uuid,p_payment_intent_id text,p_succeeded boolean
)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_res record; v_order record; v_fee bigint;
begin
  insert into payment_webhook_events(event_id,event_type,payment_session_id)
  values(p_event_id,p_event_type,p_session_id) on conflict do nothing;
  if not found then return false; end if;
  if not exists(select 1 from payment_sessions where id=p_session_id and stripe_payment_intent_id=p_payment_intent_id) then
    raise exception 'Payment intent does not match checkout session';
  end if;
  if p_succeeded then
    for v_res in select * from inventory_reservations where payment_session_id=p_session_id and status='pending' for update loop
      update product_variants set inventory_quantity=case when track_inventory then inventory_quantity-v_res.quantity else inventory_quantity end,updated_at=now()
      where id=v_res.variant_id and (not track_inventory or inventory_policy='continue' or inventory_quantity>=v_res.quantity);
      if not found then raise exception 'Reserved inventory is no longer available'; end if;
      update inventory_reservations set status='consumed',updated_at=now() where id=v_res.id;
    end loop;
    update payment_sessions set status='paid',updated_at=now() where id=p_session_id;
    update orders set status='confirmed',payment_status='paid',updated_at=now() where payment_session_id=p_session_id;
    for v_order in select * from orders where payment_session_id=p_session_id loop
      v_fee:=round(v_order.total_cents*0.10);
      insert into escrow_transactions(order_id,seller_id,amount_cents,status)
      values(v_order.id,v_order.seller_id,v_order.total_cents-v_fee,'held') on conflict(order_id) do nothing;
      update orders set metadata=metadata||jsonb_build_object('platform_fee_cents',v_fee) where id=v_order.id;
    end loop;
  else
    update payment_sessions set status='failed',updated_at=now() where id=p_session_id;
    update inventory_reservations set status='released',updated_at=now() where payment_session_id=p_session_id and status='pending';
    update orders set status='cancelled',payment_status='failed',updated_at=now() where payment_session_id=p_session_id and payment_status='pending';
  end if;
  return true;
end; $$;

revoke all on function public.create_checkout_session(jsonb,jsonb,uuid) from public,anon;
revoke all on function public.attach_checkout_payment_intent(uuid,text) from public,anon;
revoke all on function public.cancel_checkout_session(uuid) from public,anon;
revoke all on function public.finalize_checkout_payment(text,text,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.create_checkout_session(jsonb,jsonb,uuid) to authenticated;
grant execute on function public.attach_checkout_payment_intent(uuid,text) to authenticated;
grant execute on function public.cancel_checkout_session(uuid) to authenticated;
grant execute on function public.finalize_checkout_payment(text,text,uuid,text,boolean) to service_role;
