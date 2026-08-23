-- EntizNetStore combined M3 — trusted Admin order search/detail read model.
-- Operational staff need global commerce visibility without direct Supabase
-- access. This migration intentionally adds no arbitrary order-state mutation;
-- state changes continue through canonical trusted state machines.

begin;

create or replace function public.admin_search_marketplace_orders(
  p_admin_id uuid,
  p_query text,
  p_order_status text,
  p_payment_status text,
  p_fulfillment_status text,
  p_limit integer,
  p_offset integer
)
returns table(
  order_id uuid,
  order_number text,
  buyer_id uuid,
  buyer_email text,
  seller_id uuid,
  seller_email text,
  seller_storefront_name text,
  order_status text,
  payment_status text,
  fulfillment_status text,
  currency text,
  total_cents bigint,
  payment_session_id uuid,
  payment_session_status text,
  payment_provider text,
  provider_payment_id text,
  escrow_status text,
  escrow_amount_cents bigint,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_query text := lower(btrim(coalesce(p_query, '')));
  v_order_status text := lower(btrim(coalesce(p_order_status, 'all')));
  v_payment_status text := lower(btrim(coalesce(p_payment_status, 'all')));
  v_fulfillment_status text := lower(btrim(coalesce(p_fulfillment_status, 'all')));
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if p_admin_id is null
     or not exists (
       select 1 from auth.users u
       where u.id = p_admin_id
         and u.raw_app_meta_data->>'role' = 'admin'
     ) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;

  if char_length(v_query) > 200 then
    raise exception 'order_search_query_too_long' using errcode = '22023';
  end if;
  if v_order_status not in ('all','pending','confirmed','processing','shipped','delivered','cancelled','refunded') then
    raise exception 'invalid_order_status_filter' using errcode = '22023';
  end if;
  if v_payment_status not in ('all','pending','paid','failed','refunded','partially_refunded') then
    raise exception 'invalid_payment_status_filter' using errcode = '22023';
  end if;
  if v_fulfillment_status not in ('all','unfulfilled','partial','fulfilled') then
    raise exception 'invalid_fulfillment_status_filter' using errcode = '22023';
  end if;

  return query
  with rows as (
    select
      o.id as order_id,
      o.order_number,
      o.buyer_id,
      buyer.email::text as buyer_email,
      o.seller_id,
      seller.email::text as seller_email,
      pseller.storefront_name as seller_storefront_name,
      o.status as order_status,
      o.payment_status,
      o.fulfillment_status,
      coalesce(pay.currency, 'usd') as currency,
      o.total_cents,
      o.payment_session_id,
      pay.status as payment_session_status,
      pay.payment_provider,
      pay.provider_payment_id,
      escrow.status as escrow_status,
      coalesce(escrow.amount_cents, 0)::bigint as escrow_amount_cents,
      o.created_at,
      o.updated_at
    from public.orders o
    join auth.users buyer on buyer.id = o.buyer_id
    join auth.users seller on seller.id = o.seller_id
    left join public.profiles_seller pseller on pseller.id = o.seller_id
    left join public.payment_sessions pay on pay.id = o.payment_session_id
    left join lateral (
      select
        case
          when bool_or(e.status = 'held') then 'held'
          when bool_or(e.status = 'released') then 'released'
          when bool_or(e.status = 'refunded') then 'refunded'
          else null
        end as status,
        sum(e.amount_cents)::bigint as amount_cents
      from public.escrow_transactions e
      where e.order_id = o.id
    ) escrow on true
    where
      (
        v_query = ''
        or lower(o.order_number) like '%' || v_query || '%'
        or o.id::text = v_query
        or o.buyer_id::text = v_query
        or o.seller_id::text = v_query
        or lower(coalesce(buyer.email::text, '')) like '%' || v_query || '%'
        or lower(coalesce(seller.email::text, '')) like '%' || v_query || '%'
        or lower(coalesce(pseller.storefront_name, '')) like '%' || v_query || '%'
        or lower(coalesce(pay.provider_payment_id, '')) like '%' || v_query || '%'
        or pay.id::text = v_query
      )
      and (v_order_status = 'all' or o.status = v_order_status)
      and (v_payment_status = 'all' or o.payment_status = v_payment_status)
      and (v_fulfillment_status = 'all' or o.fulfillment_status = v_fulfillment_status)
  )
  select
    r.order_id, r.order_number, r.buyer_id, r.buyer_email,
    r.seller_id, r.seller_email, r.seller_storefront_name,
    r.order_status, r.payment_status, r.fulfillment_status,
    r.currency, r.total_cents, r.payment_session_id,
    r.payment_session_status, r.payment_provider, r.provider_payment_id,
    r.escrow_status, r.escrow_amount_cents,
    r.created_at, r.updated_at,
    count(*) over() as total_count
  from rows r
  order by r.created_at desc, r.order_id
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.admin_search_marketplace_orders(uuid,text,text,text,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.admin_search_marketplace_orders(uuid,text,text,text,text,integer,integer)
  to service_role;

create or replace function public.admin_get_marketplace_order(
  p_admin_id uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_result jsonb;
begin
  if p_admin_id is null
     or not exists (
       select 1 from auth.users u
       where u.id = p_admin_id
         and u.raw_app_meta_data->>'role' = 'admin'
     ) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', o.id,
    'orderNumber', o.order_number,
    'status', o.status,
    'paymentStatus', o.payment_status,
    'fulfillmentStatus', o.fulfillment_status,
    'subtotalCents', o.subtotal_cents,
    'taxCents', o.tax_cents,
    'shippingCents', o.shipping_cents,
    'discountCents', o.discount_cents,
    'totalCents', o.total_cents,
    'shippingAddress', o.shipping_address,
    'billingAddress', o.billing_address,
    'shippingMethod', o.shipping_method,
    'trackingNumber', o.tracking_number,
    'shippingCarrier', o.shipping_carrier,
    'shippedAt', o.shipped_at,
    'deliveredAt', o.delivered_at,
    'notes', o.notes,
    'metadata', o.metadata,
    'createdAt', o.created_at,
    'updatedAt', o.updated_at,
    'buyer', jsonb_build_object(
      'id', o.buyer_id,
      'email', buyer.email,
      'displayName', pb.display_name,
      'firstName', pb.first_name,
      'lastName', pb.last_name,
      'capabilityActive', public.marketplace_capability_is_active(o.buyer_id, 'buyer')
    ),
    'seller', jsonb_build_object(
      'id', o.seller_id,
      'email', seller.email,
      'storefrontName', pseller.storefront_name,
      'storeSlug', pseller.store_slug,
      'verificationStatus', pseller.verification_status,
      'capabilityActive', public.marketplace_capability_is_active(o.seller_id, 'seller')
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'productId', oi.product_id,
        'variantId', oi.variant_id,
        'productTitle', oi.product_title,
        'variantTitle', oi.variant_title,
        'sku', oi.sku,
        'quantity', oi.quantity,
        'priceCents', oi.price_cents,
        'totalCents', oi.total_cents,
        'requiresShipping', oi.requires_shipping,
        'isDigital', oi.is_digital,
        'fulfillmentStatus', oi.fulfillment_status,
        'createdAt', oi.created_at
      ) order by oi.created_at, oi.id)
      from public.order_items oi
      where oi.order_id = o.id
    ), '[]'::jsonb),
    'paymentSession', case when pay.id is null then null else jsonb_build_object(
      'id', pay.id,
      'status', pay.status,
      'currency', pay.currency,
      'amountCents', pay.amount_cents,
      'paymentProvider', pay.payment_provider,
      'providerPaymentId', pay.provider_payment_id,
      'idempotencyKey', pay.idempotency_key,
      'createdAt', pay.created_at,
      'updatedAt', pay.updated_at
    ) end,
    'escrow', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'sellerId', e.seller_id,
        'amountCents', e.amount_cents,
        'status', e.status,
        'releasedAt', e.released_at,
        'releaseReason', e.release_reason,
        'disputeId', e.dispute_id,
        'createdAt', e.created_at,
        'updatedAt', e.updated_at
      ) order by e.created_at, e.id)
      from public.escrow_transactions e
      where e.order_id = o.id
    ), '[]'::jsonb),
    'payouts', coalesce((
      select jsonb_agg(payout_row order by (payout_row->>'createdAt') desc)
      from (
        select distinct jsonb_build_object(
          'id', pr.id,
          'sellerId', pr.seller_id,
          'status', pr.status,
          'currency', pr.currency,
          'amountCents', pr.amount_cents,
          'provider', pr.provider,
          'providerPayoutId', pr.provider_payout_id,
          'failureCode', pr.failure_code,
          'failureMessage', pr.failure_message,
          'createdAt', pr.created_at,
          'updatedAt', pr.updated_at,
          'completedAt', pr.completed_at
        ) as payout_row
        from public.payout_requests pr
        join public.payout_items pi on pi.payout_request_id = pr.id
        join public.escrow_transactions e on e.id = pi.escrow_transaction_id
        where e.order_id = o.id
      ) payout_rows
    ), '[]'::jsonb),
    'recentAudit', coalesce((
      select jsonb_agg(audit_row order by (audit_row->>'timestamp') desc)
      from (
        select jsonb_build_object(
          'id', a.id,
          'adminId', a.admin_id,
          'action', a.action,
          'targetType', a.target_type,
          'targetId', a.target_id,
          'metadata', a.metadata,
          'timestamp', a.timestamp
        ) as audit_row
        from public.admin_audit_logs a
        where (a.target_type = 'order' and a.target_id = o.id::text)
           or (a.metadata->>'order_id' = o.id::text)
        order by a.timestamp desc
        limit 50
      ) recent
    ), '[]'::jsonb)
  ) into v_result
  from public.orders o
  join auth.users buyer on buyer.id = o.buyer_id
  join auth.users seller on seller.id = o.seller_id
  left join public.profiles_buyer pb on pb.id = o.buyer_id
  left join public.profiles_seller pseller on pseller.id = o.seller_id
  left join public.payment_sessions pay on pay.id = o.payment_session_id
  where o.id = p_order_id;

  if v_result is null then
    raise exception 'marketplace_order_not_found' using errcode = '22023';
  end if;

  return v_result;
end;
$$;

revoke all on function public.admin_get_marketplace_order(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.admin_get_marketplace_order(uuid,uuid)
  to service_role;

commit;
