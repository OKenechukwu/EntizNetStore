create or replace function public.transition_seller_order(
  p_order_id uuid,
  p_next_status text,
  p_tracking_number text default null,
  p_shipping_carrier text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id and seller_id = auth.uid()
  for update;

  if not found then
    raise exception 'Order not found' using errcode = '42501';
  end if;
  if v_order.payment_status <> 'paid' then
    raise exception 'Only paid orders can be fulfilled' using errcode = '22023';
  end if;

  if p_next_status = 'processing' and v_order.status = 'confirmed' then
    update public.orders
    set status = 'processing', updated_at = now()
    where id = p_order_id;
  elsif p_next_status = 'shipped' and v_order.status = 'processing' then
    if nullif(btrim(p_tracking_number), '') is null
       or nullif(btrim(p_shipping_carrier), '') is null then
      raise exception 'Carrier and tracking number are required' using errcode = '22023';
    end if;
    update public.orders
    set status = 'shipped',
        fulfillment_status = 'partial',
        tracking_number = btrim(p_tracking_number),
        shipping_carrier = btrim(p_shipping_carrier),
        shipped_at = now(),
        updated_at = now()
    where id = p_order_id;
  elsif p_next_status = 'delivered' and v_order.status = 'shipped' then
    update public.orders
    set status = 'delivered',
        fulfillment_status = 'fulfilled',
        delivered_at = now(),
        updated_at = now()
    where id = p_order_id;
  else
    raise exception 'Invalid order status transition' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.transition_seller_order(uuid,text,text,text)
  from public, anon;
grant execute on function public.transition_seller_order(uuid,text,text,text)
  to authenticated;
