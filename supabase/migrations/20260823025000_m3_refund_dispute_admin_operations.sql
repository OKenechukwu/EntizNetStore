-- EntizNetStore combined M3 — refund/dispute Admin operations read model and
-- lifecycle tightening. Buyer-favoring resolutions remain escrow-blocking until
-- a trusted provider refund succeeds; ordinary Admin closure cannot bypass it.

begin;

-- One dispute lifecycle per order until explicitly closed. Resolved Buyer cases
-- are intentionally still open operational work until refund completion.
drop index if exists public.order_disputes_one_active_per_order;
create unique index order_disputes_one_nonclosed_per_order
  on public.order_disputes(order_id)
  where status <> 'closed';

create or replace function public.admin_transition_order_dispute(
  p_admin_id uuid,
  p_dispute_id uuid,
  p_status text,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_dispute public.order_disputes%rowtype;
  v_next text := lower(btrim(coalesce(p_status, '')));
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  if p_admin_id is null or not exists (
    select 1 from auth.users u
    where u.id = p_admin_id and u.raw_app_meta_data->>'role' = 'admin'
  ) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;
  if v_next not in ('under_review','resolved_buyer','resolved_seller','closed') then
    raise exception 'invalid_dispute_status' using errcode = '22023';
  end if;
  if char_length(coalesce(v_notes, '')) > 10000 then
    raise exception 'dispute_notes_too_long' using errcode = '22023';
  end if;
  if v_next in ('resolved_buyer','resolved_seller','closed') and v_notes is null then
    raise exception 'dispute_resolution_notes_required' using errcode = '22023';
  end if;

  select * into v_dispute
  from public.order_disputes
  where id = p_dispute_id
  for update;
  if not found then raise exception 'dispute_not_found' using errcode = '22023'; end if;
  if v_dispute.status = 'closed' then
    raise exception 'dispute_already_closed' using errcode = '22023';
  end if;

  -- A Buyer-favoring decision is money-sensitive. Its dispute hold is cleared
  -- only by finalize_refund_v1 after provider-confirmed refund success.
  if v_dispute.status = 'resolved_buyer' then
    raise exception 'buyer_resolution_requires_refund_completion' using errcode = '55000';
  end if;
  if v_dispute.status = 'resolved_seller' and v_next <> 'closed' then
    raise exception 'seller_resolution_can_only_close' using errcode = '22023';
  end if;

  update public.order_disputes
  set status = v_next,
      assigned_admin_id = p_admin_id,
      resolution_notes = case
        when v_next in ('resolved_buyer','resolved_seller','closed') then v_notes
        else resolution_notes
      end,
      resolved_at = case
        when v_next in ('resolved_buyer','resolved_seller','closed') then coalesce(resolved_at, now())
        else resolved_at
      end,
      updated_at = now()
  where id = p_dispute_id;

  insert into public.order_dispute_events(dispute_id, actor_id, actor_type, action, notes)
  values (p_dispute_id, p_admin_id, 'admin', v_next, v_notes);

  -- Seller-favoring cases may release escrow only when explicitly closed after
  -- the resolution is recorded. Direct under_review -> closed is also treated
  -- as an operational closure and releases the dispute hold.
  if v_next = 'closed' then
    update public.escrow_transactions
    set dispute_id = null, updated_at = now()
    where order_id = v_dispute.order_id and dispute_id = p_dispute_id;
  end if;

  insert into public.admin_audit_logs(
    admin_id, action, target_type, target_id, metadata, timestamp, created_at
  ) values (
    p_admin_id,
    'order_dispute_' || v_next,
    'order_dispute',
    p_dispute_id::text,
    jsonb_build_object(
      'order_id', v_dispute.order_id,
      'previous_status', v_dispute.status,
      'status', v_next,
      'notes', v_notes
    ),
    now(), now()
  );
end;
$$;

revoke all on function public.admin_transition_order_dispute(uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.admin_transition_order_dispute(uuid,uuid,text,text)
  to service_role;

create or replace function public.admin_search_order_disputes(
  p_admin_id uuid,
  p_query text,
  p_status text,
  p_priority text,
  p_limit integer,
  p_offset integer
)
returns table(
  dispute_id uuid,
  order_id uuid,
  order_number text,
  buyer_id uuid,
  buyer_email text,
  seller_id uuid,
  seller_email text,
  seller_storefront_name text,
  raised_by uuid,
  raised_by_role text,
  reason_code text,
  details text,
  priority text,
  dispute_status text,
  assigned_admin_id uuid,
  resolution_notes text,
  escrow_status text,
  escrow_amount_cents bigint,
  refund_status text,
  refund_amount_cents bigint,
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
  v_status text := lower(btrim(coalesce(p_status, 'all')));
  v_priority text := lower(btrim(coalesce(p_priority, 'all')));
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if p_admin_id is null or not exists (
    select 1 from auth.users u
    where u.id = p_admin_id and u.raw_app_meta_data->>'role' = 'admin'
  ) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;
  if char_length(v_query) > 200 then raise exception 'dispute_search_query_too_long' using errcode = '22023'; end if;
  if v_status not in ('all','open','under_review','resolved_buyer','resolved_seller','closed') then
    raise exception 'invalid_dispute_status_filter' using errcode = '22023';
  end if;
  if v_priority not in ('all','low','normal','high','urgent') then
    raise exception 'invalid_dispute_priority_filter' using errcode = '22023';
  end if;

  return query
  with rows as (
    select
      d.id as dispute_id,
      d.order_id,
      o.order_number,
      o.buyer_id,
      buyer.email::text as buyer_email,
      o.seller_id,
      seller.email::text as seller_email,
      ps.storefront_name as seller_storefront_name,
      d.raised_by,
      d.raised_by_role,
      d.reason_code,
      d.details,
      d.priority,
      d.status as dispute_status,
      d.assigned_admin_id,
      d.resolution_notes,
      e.status as escrow_status,
      e.amount_cents as escrow_amount_cents,
      rr.status as refund_status,
      rr.amount_cents as refund_amount_cents,
      d.created_at,
      d.updated_at
    from public.order_disputes d
    join public.orders o on o.id = d.order_id
    join auth.users buyer on buyer.id = o.buyer_id
    join auth.users seller on seller.id = o.seller_id
    left join public.profiles_seller ps on ps.id = o.seller_id
    left join public.escrow_transactions e on e.order_id = o.id
    left join lateral (
      select r.status, r.amount_cents
      from public.refund_requests r
      where r.order_id = o.id
      order by r.created_at desc
      limit 1
    ) rr on true
    where (
      v_query = ''
      or lower(o.order_number) like '%' || v_query || '%'
      or d.id::text = v_query
      or o.id::text = v_query
      or lower(coalesce(buyer.email::text,'')) like '%' || v_query || '%'
      or lower(coalesce(seller.email::text,'')) like '%' || v_query || '%'
      or lower(coalesce(ps.storefront_name,'')) like '%' || v_query || '%'
    )
      and (v_status = 'all' or d.status = v_status)
      and (v_priority = 'all' or d.priority = v_priority)
  )
  select r.*, count(*) over() as total_count
  from rows r
  order by
    case r.priority when 'urgent' then 1 when 'high' then 2 when 'normal' then 3 else 4 end,
    r.created_at asc,
    r.dispute_id
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.admin_search_order_disputes(uuid,text,text,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.admin_search_order_disputes(uuid,text,text,text,integer,integer)
  to service_role;

create or replace function public.admin_search_refund_requests(
  p_admin_id uuid,
  p_query text,
  p_status text,
  p_limit integer,
  p_offset integer
)
returns table(
  refund_request_id uuid,
  order_id uuid,
  order_number text,
  buyer_id uuid,
  buyer_email text,
  seller_id uuid,
  seller_email text,
  seller_storefront_name text,
  dispute_id uuid,
  amount_cents bigint,
  currency text,
  reason text,
  refund_status text,
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  payment_provider text,
  provider_refund_id text,
  failure_code text,
  failure_message text,
  payout_claim_exists boolean,
  escrow_status text,
  escrow_amount_cents bigint,
  created_at timestamptz,
  updated_at timestamptz,
  completed_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_query text := lower(btrim(coalesce(p_query, '')));
  v_status text := lower(btrim(coalesce(p_status, 'all')));
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if p_admin_id is null or not exists (
    select 1 from auth.users u
    where u.id = p_admin_id and u.raw_app_meta_data->>'role' = 'admin'
  ) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;
  if char_length(v_query) > 200 then raise exception 'refund_search_query_too_long' using errcode = '22023'; end if;
  if v_status not in ('all','requested','approved','rejected','processing','succeeded','failed','cancelled') then
    raise exception 'invalid_refund_status_filter' using errcode = '22023';
  end if;

  return query
  with rows as (
    select
      rr.id as refund_request_id,
      rr.order_id,
      o.order_number,
      o.buyer_id,
      buyer.email::text as buyer_email,
      o.seller_id,
      seller.email::text as seller_email,
      ps.storefront_name as seller_storefront_name,
      rr.dispute_id,
      rr.amount_cents,
      rr.currency,
      rr.reason,
      rr.status as refund_status,
      rr.admin_notes,
      rr.reviewed_by,
      rr.reviewed_at,
      rr.payment_provider,
      rr.provider_refund_id,
      rr.failure_code,
      rr.failure_message,
      exists (
        select 1
        from public.escrow_transactions pe
        join public.payout_items pi on pi.escrow_transaction_id = pe.id
        where pe.order_id = o.id and pi.status in ('reserved','settled')
      ) as payout_claim_exists,
      e.status as escrow_status,
      e.amount_cents as escrow_amount_cents,
      rr.created_at,
      rr.updated_at,
      rr.completed_at
    from public.refund_requests rr
    join public.orders o on o.id = rr.order_id
    join auth.users buyer on buyer.id = o.buyer_id
    join auth.users seller on seller.id = o.seller_id
    left join public.profiles_seller ps on ps.id = o.seller_id
    left join public.escrow_transactions e on e.order_id = o.id
    where (
      v_query = ''
      or lower(o.order_number) like '%' || v_query || '%'
      or rr.id::text = v_query
      or o.id::text = v_query
      or lower(coalesce(buyer.email::text,'')) like '%' || v_query || '%'
      or lower(coalesce(seller.email::text,'')) like '%' || v_query || '%'
      or lower(coalesce(ps.storefront_name,'')) like '%' || v_query || '%'
      or lower(coalesce(rr.provider_refund_id,'')) like '%' || v_query || '%'
    )
      and (v_status = 'all' or rr.status = v_status)
  )
  select r.*, count(*) over() as total_count
  from rows r
  order by
    case r.refund_status
      when 'requested' then 1
      when 'approved' then 2
      when 'processing' then 3
      when 'failed' then 4
      else 5
    end,
    r.created_at asc,
    r.refund_request_id
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.admin_search_refund_requests(uuid,text,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.admin_search_refund_requests(uuid,text,text,integer,integer)
  to service_role;

-- Extend the global order console with case history without exposing raw tables.
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
  if p_admin_id is null or not exists (
    select 1 from auth.users u
    where u.id = p_admin_id and u.raw_app_meta_data->>'role' = 'admin'
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
        'id', oi.id, 'productId', oi.product_id, 'variantId', oi.variant_id,
        'productTitle', oi.product_title, 'variantTitle', oi.variant_title,
        'sku', oi.sku, 'quantity', oi.quantity, 'priceCents', oi.price_cents,
        'totalCents', oi.total_cents, 'requiresShipping', oi.requires_shipping,
        'isDigital', oi.is_digital, 'fulfillmentStatus', oi.fulfillment_status,
        'createdAt', oi.created_at
      ) order by oi.created_at, oi.id)
      from public.order_items oi where oi.order_id = o.id
    ), '[]'::jsonb),
    'paymentSession', case when pay.id is null then null else jsonb_build_object(
      'id', pay.id, 'status', pay.status, 'currency', pay.currency,
      'amountCents', pay.amount_cents, 'paymentProvider', pay.payment_provider,
      'providerPaymentId', pay.provider_payment_id, 'idempotencyKey', pay.idempotency_key,
      'createdAt', pay.created_at, 'updatedAt', pay.updated_at
    ) end,
    'escrow', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'sellerId', e.seller_id, 'amountCents', e.amount_cents,
        'status', e.status, 'releasedAt', e.released_at,
        'releaseReason', e.release_reason, 'disputeId', e.dispute_id,
        'createdAt', e.created_at, 'updatedAt', e.updated_at
      ) order by e.created_at, e.id)
      from public.escrow_transactions e where e.order_id = o.id
    ), '[]'::jsonb),
    'disputes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'raisedBy', d.raised_by, 'raisedByRole', d.raised_by_role,
        'reasonCode', d.reason_code, 'details', d.details, 'priority', d.priority,
        'status', d.status, 'assignedAdminId', d.assigned_admin_id,
        'resolutionNotes', d.resolution_notes, 'resolvedAt', d.resolved_at,
        'createdAt', d.created_at, 'updatedAt', d.updated_at
      ) order by d.created_at desc)
      from public.order_disputes d where d.order_id = o.id
    ), '[]'::jsonb),
    'refunds', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'disputeId', r.dispute_id, 'amountCents', r.amount_cents,
        'currency', r.currency, 'reason', r.reason, 'status', r.status,
        'adminNotes', r.admin_notes, 'reviewedBy', r.reviewed_by,
        'reviewedAt', r.reviewed_at, 'paymentProvider', r.payment_provider,
        'providerRefundId', r.provider_refund_id, 'failureCode', r.failure_code,
        'failureMessage', r.failure_message, 'createdAt', r.created_at,
        'updatedAt', r.updated_at, 'completedAt', r.completed_at
      ) order by r.created_at desc)
      from public.refund_requests r where r.order_id = o.id
    ), '[]'::jsonb),
    'payouts', coalesce((
      select jsonb_agg(payout_row order by (payout_row->>'createdAt') desc)
      from (
        select distinct jsonb_build_object(
          'id', pr.id, 'sellerId', pr.seller_id, 'status', pr.status,
          'currency', pr.currency, 'amountCents', pr.amount_cents,
          'provider', pr.provider, 'providerPayoutId', pr.provider_payout_id,
          'failureCode', pr.failure_code, 'failureMessage', pr.failure_message,
          'createdAt', pr.created_at, 'updatedAt', pr.updated_at,
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
          'id', a.id, 'adminId', a.admin_id, 'action', a.action,
          'targetType', a.target_type, 'targetId', a.target_id,
          'metadata', a.metadata, 'timestamp', a.timestamp
        ) as audit_row
        from public.admin_audit_logs a
        where (a.target_type = 'order' and a.target_id = o.id::text)
           or (a.metadata->>'order_id' = o.id::text)
        order by a.timestamp desc limit 50
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

  if v_result is null then raise exception 'marketplace_order_not_found' using errcode = '22023'; end if;
  return v_result;
end;
$$;

revoke all on function public.admin_get_marketplace_order(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.admin_get_marketplace_order(uuid,uuid)
  to service_role;

commit;
