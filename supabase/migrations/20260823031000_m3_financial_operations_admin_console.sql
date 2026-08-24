-- EntizNetStore combined M3 — financial operations and audit control plane.
--
-- No duplicate accounting ledger is introduced here. Revenue, refunds, escrow and
-- payouts are read from the canonical order/payment/refund/escrow/payout records.
-- Provider execution remains trusted-adapter-only and fail-closed.

begin;

create index if not exists idx_admin_audit_logs_target
  on public.admin_audit_logs(target_type, target_id, timestamp desc);
create index if not exists idx_escrow_transactions_status_created
  on public.escrow_transactions(status, created_at desc);

create or replace function public.admin_get_financial_operations_summary(
  p_admin_id uuid
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
    'grossSalesCents', coalesce((
      select sum(o.total_cents)::bigint
      from public.orders o
      where o.payment_status in ('paid','partially_refunded','refunded')
    ), 0),
    'customerRefundedCents', coalesce((
      select sum(coalesce(nullif(o.metadata->>'refunded_cents','')::bigint, 0))::bigint
      from public.orders o
      where o.payment_status in ('partially_refunded','refunded')
    ), 0),
    'netGmvCents', coalesce((
      select sum(
        o.total_cents - coalesce(nullif(o.metadata->>'refunded_cents','')::bigint, 0)
      )::bigint
      from public.orders o
      where o.payment_status in ('paid','partially_refunded','refunded')
    ), 0),
    'grossPlatformRevenueCents', coalesce((
      select sum(coalesce(
        nullif(o.metadata->>'platform_fee_cents','')::bigint,
        round(o.total_cents * 0.10)::bigint
      ))::bigint
      from public.orders o
      where o.payment_status in ('paid','partially_refunded','refunded')
    ), 0),
    'platformRevenueRefundedCents', coalesce((
      select sum(coalesce(nullif(o.metadata->>'platform_fee_refunded_cents','')::bigint, 0))::bigint
      from public.orders o
      where o.payment_status in ('partially_refunded','refunded')
    ), 0),
    'netPlatformRevenueCents', coalesce((
      select sum(
        coalesce(nullif(o.metadata->>'platform_fee_cents','')::bigint, round(o.total_cents * 0.10)::bigint)
        - coalesce(nullif(o.metadata->>'platform_fee_refunded_cents','')::bigint, 0)
      )::bigint
      from public.orders o
      where o.payment_status in ('paid','partially_refunded','refunded')
    ), 0),
    'escrowHeldCents', coalesce((select sum(e.amount_cents)::bigint from public.escrow_transactions e where e.status = 'held'), 0),
    'escrowReleasedCents', coalesce((select sum(e.amount_cents)::bigint from public.escrow_transactions e where e.status = 'released'), 0),
    'payoutPendingCents', coalesce((select sum(p.amount_cents)::bigint from public.payout_requests p where p.status = 'pending'), 0),
    'payoutProcessingCents', coalesce((select sum(p.amount_cents)::bigint from public.payout_requests p where p.status = 'processing'), 0),
    'payoutSucceededCents', coalesce((select sum(p.amount_cents)::bigint from public.payout_requests p where p.status = 'succeeded'), 0),
    'openDisputes', (select count(*) from public.order_disputes d where d.status <> 'closed'),
    'pendingRefunds', (select count(*) from public.refund_requests r where r.status in ('requested','approved','processing')),
    'paymentSessionsRequiringPayment', (select count(*) from public.payment_sessions p where p.status in ('pending','requires_payment')),
    'paidOrders', (select count(*) from public.orders o where o.payment_status in ('paid','partially_refunded','refunded')),
    'generatedAt', now()
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.admin_search_financial_transactions(
  p_admin_id uuid,
  p_query text,
  p_type text,
  p_status text,
  p_limit integer,
  p_offset integer
)
returns table(
  transaction_type text,
  transaction_id uuid,
  order_id uuid,
  order_number text,
  account_id uuid,
  account_email text,
  counterparty_id uuid,
  counterparty_email text,
  transaction_status text,
  amount_cents bigint,
  currency text,
  provider text,
  provider_reference text,
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
  v_type text := lower(btrim(coalesce(p_type, 'all')));
  v_status text := lower(btrim(coalesce(p_status, 'all')));
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if p_admin_id is null or not exists (
    select 1 from auth.users u where u.id = p_admin_id and u.raw_app_meta_data->>'role' = 'admin'
  ) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;
  if char_length(v_query) > 200 then raise exception 'transaction_search_query_too_long' using errcode = '22023'; end if;
  if v_type not in ('all','payment','refund','payout','escrow') then raise exception 'invalid_transaction_type_filter' using errcode = '22023'; end if;
  if char_length(v_status) > 50 then raise exception 'invalid_transaction_status_filter' using errcode = '22023'; end if;

  return query
  with payment_rows as (
    select
      'payment'::text as transaction_type,
      ps.id as transaction_id,
      first_order.id as order_id,
      first_order.order_number,
      ps.buyer_id as account_id,
      buyer.email::text as account_email,
      null::uuid as counterparty_id,
      null::text as counterparty_email,
      ps.status as transaction_status,
      ps.amount_cents,
      ps.currency,
      ps.payment_provider as provider,
      ps.provider_payment_id as provider_reference,
      ps.created_at,
      ps.updated_at
    from public.payment_sessions ps
    join auth.users buyer on buyer.id = ps.buyer_id
    left join lateral (
      select o.id, o.order_number
      from public.orders o
      where o.payment_session_id = ps.id
      order by o.created_at, o.id
      limit 1
    ) first_order on true
  ), refund_rows as (
    select
      'refund'::text,
      rr.id,
      o.id,
      o.order_number,
      rr.buyer_id,
      buyer.email::text,
      o.seller_id,
      seller.email::text,
      rr.status,
      rr.amount_cents,
      rr.currency,
      rr.payment_provider,
      rr.provider_refund_id,
      rr.created_at,
      rr.updated_at
    from public.refund_requests rr
    join public.orders o on o.id = rr.order_id
    join auth.users buyer on buyer.id = rr.buyer_id
    join auth.users seller on seller.id = o.seller_id
  ), payout_rows as (
    select
      'payout'::text,
      pr.id,
      first_order.id,
      first_order.order_number,
      pr.seller_id,
      seller.email::text,
      null::uuid,
      null::text,
      pr.status,
      pr.amount_cents,
      pr.currency,
      pr.provider,
      pr.provider_payout_id,
      pr.created_at,
      pr.updated_at
    from public.payout_requests pr
    join auth.users seller on seller.id = pr.seller_id
    left join lateral (
      select o.id, o.order_number
      from public.payout_items pi
      join public.escrow_transactions e on e.id = pi.escrow_transaction_id
      join public.orders o on o.id = e.order_id
      where pi.payout_request_id = pr.id
      order by o.created_at, o.id
      limit 1
    ) first_order on true
  ), escrow_rows as (
    select
      'escrow'::text,
      e.id,
      o.id,
      o.order_number,
      e.seller_id,
      seller.email::text,
      o.buyer_id,
      buyer.email::text,
      e.status,
      e.amount_cents,
      'usd'::text,
      null::text,
      null::text,
      e.created_at,
      e.updated_at
    from public.escrow_transactions e
    join public.orders o on o.id = e.order_id
    join auth.users seller on seller.id = e.seller_id
    join auth.users buyer on buyer.id = o.buyer_id
  ), all_rows as (
    select * from payment_rows
    union all select * from refund_rows
    union all select * from payout_rows
    union all select * from escrow_rows
  ), filtered as (
    select r.*
    from all_rows r
    where (v_type = 'all' or r.transaction_type = v_type)
      and (v_status = 'all' or lower(r.transaction_status) = v_status)
      and (
        v_query = ''
        or r.transaction_id::text = v_query
        or coalesce(r.order_id::text,'') = v_query
        or lower(coalesce(r.order_number,'')) like '%' || v_query || '%'
        or lower(coalesce(r.account_email,'')) like '%' || v_query || '%'
        or lower(coalesce(r.counterparty_email,'')) like '%' || v_query || '%'
        or lower(coalesce(r.provider_reference,'')) like '%' || v_query || '%'
        or lower(coalesce(r.provider,'')) like '%' || v_query || '%'
      )
  )
  select
    f.transaction_type, f.transaction_id, f.order_id, f.order_number,
    f.account_id, f.account_email, f.counterparty_id, f.counterparty_email,
    f.transaction_status, f.amount_cents, f.currency, f.provider,
    f.provider_reference, f.created_at, f.updated_at,
    count(*) over() as total_count
  from filtered f
  order by f.created_at desc, f.transaction_id
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.admin_search_payout_requests(
  p_admin_id uuid,
  p_query text,
  p_status text,
  p_limit integer,
  p_offset integer
)
returns table(
  payout_request_id uuid,
  seller_id uuid,
  seller_email text,
  seller_storefront_name text,
  payout_status text,
  amount_cents bigint,
  currency text,
  provider text,
  provider_payout_id text,
  failure_code text,
  failure_message text,
  item_count bigint,
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
    select 1 from auth.users u where u.id = p_admin_id and u.raw_app_meta_data->>'role' = 'admin'
  ) then raise exception 'admin_authorization_required' using errcode = '42501'; end if;
  if char_length(v_query) > 200 then raise exception 'payout_search_query_too_long' using errcode = '22023'; end if;
  if v_status not in ('all','pending','processing','succeeded','failed','cancelled') then raise exception 'invalid_payout_status_filter' using errcode = '22023'; end if;

  return query
  with rows as (
    select
      pr.id as payout_request_id,
      pr.seller_id,
      u.email::text as seller_email,
      ps.storefront_name as seller_storefront_name,
      pr.status as payout_status,
      pr.amount_cents,
      pr.currency,
      pr.provider,
      pr.provider_payout_id,
      pr.failure_code,
      pr.failure_message,
      (select count(*) from public.payout_items pi where pi.payout_request_id = pr.id)::bigint as item_count,
      pr.created_at,
      pr.updated_at,
      pr.completed_at
    from public.payout_requests pr
    join auth.users u on u.id = pr.seller_id
    left join public.profiles_seller ps on ps.id = pr.seller_id
    where (v_status = 'all' or pr.status = v_status)
      and (
        v_query = ''
        or pr.id::text = v_query
        or pr.seller_id::text = v_query
        or lower(coalesce(u.email::text,'')) like '%' || v_query || '%'
        or lower(coalesce(ps.storefront_name,'')) like '%' || v_query || '%'
        or lower(coalesce(pr.provider_payout_id,'')) like '%' || v_query || '%'
      )
  )
  select r.*, count(*) over() as total_count
  from rows r
  order by r.created_at desc, r.payout_request_id
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.admin_search_escrow_transactions(
  p_admin_id uuid,
  p_query text,
  p_status text,
  p_limit integer,
  p_offset integer
)
returns table(
  escrow_transaction_id uuid,
  order_id uuid,
  order_number text,
  seller_id uuid,
  seller_email text,
  seller_storefront_name text,
  escrow_status text,
  amount_cents bigint,
  dispute_id uuid,
  payout_request_id uuid,
  payout_status text,
  delivered_at timestamptz,
  released_at timestamptz,
  release_reason text,
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
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if p_admin_id is null or not exists (
    select 1 from auth.users u where u.id = p_admin_id and u.raw_app_meta_data->>'role' = 'admin'
  ) then raise exception 'admin_authorization_required' using errcode = '42501'; end if;
  if char_length(v_query) > 200 then raise exception 'escrow_search_query_too_long' using errcode = '22023'; end if;
  if v_status not in ('all','held','released','refunded') then raise exception 'invalid_escrow_status_filter' using errcode = '22023'; end if;

  return query
  with rows as (
    select
      e.id as escrow_transaction_id,
      o.id as order_id,
      o.order_number,
      e.seller_id,
      u.email::text as seller_email,
      ps.storefront_name as seller_storefront_name,
      e.status as escrow_status,
      e.amount_cents,
      e.dispute_id,
      pr.id as payout_request_id,
      pr.status as payout_status,
      o.delivered_at,
      e.released_at,
      e.release_reason,
      e.created_at,
      e.updated_at
    from public.escrow_transactions e
    join public.orders o on o.id = e.order_id
    join auth.users u on u.id = e.seller_id
    left join public.profiles_seller ps on ps.id = e.seller_id
    left join lateral (
      select p.id, p.status
      from public.payout_items pi
      join public.payout_requests p on p.id = pi.payout_request_id
      where pi.escrow_transaction_id = e.id
        and pi.status in ('reserved','settled')
      order by p.created_at desc
      limit 1
    ) pr on true
    where (v_status = 'all' or e.status = v_status)
      and (
        v_query = ''
        or e.id::text = v_query
        or o.id::text = v_query
        or lower(o.order_number) like '%' || v_query || '%'
        or e.seller_id::text = v_query
        or lower(coalesce(u.email::text,'')) like '%' || v_query || '%'
        or lower(coalesce(ps.storefront_name,'')) like '%' || v_query || '%'
        or coalesce(e.dispute_id::text,'') = v_query
        or coalesce(pr.id::text,'') = v_query
      )
  )
  select r.*, count(*) over() as total_count
  from rows r
  order by r.created_at desc, r.escrow_transaction_id
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.admin_search_audit_logs(
  p_admin_id uuid,
  p_query text,
  p_action text,
  p_limit integer,
  p_offset integer
)
returns table(
  audit_id uuid,
  actor_admin_id uuid,
  actor_email text,
  action text,
  target_type text,
  target_id text,
  metadata jsonb,
  occurred_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_query text := lower(btrim(coalesce(p_query, '')));
  v_action text := lower(btrim(coalesce(p_action, 'all')));
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if p_admin_id is null or not exists (
    select 1 from auth.users u where u.id = p_admin_id and u.raw_app_meta_data->>'role' = 'admin'
  ) then raise exception 'admin_authorization_required' using errcode = '42501'; end if;
  if char_length(v_query) > 200 or char_length(v_action) > 100 then raise exception 'invalid_audit_search_filter' using errcode = '22023'; end if;

  return query
  with rows as (
    select
      a.id as audit_id,
      a.admin_id as actor_admin_id,
      u.email::text as actor_email,
      a.action::text,
      a.target_type::text,
      a.target_id::text,
      a.metadata,
      coalesce(a.timestamp, a.created_at) as occurred_at
    from public.admin_audit_logs a
    left join auth.users u on u.id = a.admin_id
    where (v_action = 'all' or lower(a.action::text) = v_action)
      and (
        v_query = ''
        or a.id::text = v_query
        or a.admin_id::text = v_query
        or lower(coalesce(u.email::text,'')) like '%' || v_query || '%'
        or lower(coalesce(a.action::text,'')) like '%' || v_query || '%'
        or lower(coalesce(a.target_type::text,'')) like '%' || v_query || '%'
        or lower(coalesce(a.target_id::text,'')) like '%' || v_query || '%'
      )
  )
  select r.*, count(*) over() as total_count
  from rows r
  order by r.occurred_at desc, r.audit_id
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.admin_create_seller_payout(
  p_admin_id uuid,
  p_seller_id uuid,
  p_idempotency_key uuid,
  p_eligible_before timestamptz
)
returns table(payout_request_id uuid, amount_cents bigint, payout_status text)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_row record;
begin
  if p_admin_id is null or not exists (
    select 1 from auth.users u where u.id = p_admin_id and u.raw_app_meta_data->>'role' = 'admin'
  ) then raise exception 'admin_authorization_required' using errcode = '42501'; end if;

  select * into v_row
  from public.request_seller_payout(p_seller_id, p_idempotency_key, p_eligible_before);

  insert into public.admin_audit_logs(admin_id, action, target_type, target_id, metadata, timestamp, created_at)
  values (
    p_admin_id, 'seller_payout_prepared', 'payout_request', v_row.payout_request_id::text,
    jsonb_build_object('seller_id', p_seller_id, 'amount_cents', v_row.amount_cents, 'status', v_row.payout_status, 'eligible_before', p_eligible_before),
    now(), now()
  );

  return query select v_row.payout_request_id::uuid, v_row.amount_cents::bigint, v_row.payout_status::text;
end;
$$;

create or replace function public.admin_cancel_seller_payout(
  p_admin_id uuid,
  p_payout_request_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_reason text := left(coalesce(nullif(btrim(p_reason),''),'admin_cancelled'),500);
  v_result boolean;
begin
  if p_admin_id is null or not exists (
    select 1 from auth.users u where u.id = p_admin_id and u.raw_app_meta_data->>'role' = 'admin'
  ) then raise exception 'admin_authorization_required' using errcode = '42501'; end if;

  v_result := public.cancel_seller_payout_request(p_payout_request_id, v_reason);

  insert into public.admin_audit_logs(admin_id, action, target_type, target_id, metadata, timestamp, created_at)
  values (
    p_admin_id, 'seller_payout_cancelled', 'payout_request', p_payout_request_id::text,
    jsonb_build_object('reason', v_reason), now(), now()
  );

  return v_result;
end;
$$;

-- These Admin read/control functions are server-only. Browser Admin state never
-- receives direct table mutation authority.
revoke all on function public.admin_get_financial_operations_summary(uuid) from public, anon, authenticated;
revoke all on function public.admin_search_financial_transactions(uuid,text,text,text,integer,integer) from public, anon, authenticated;
revoke all on function public.admin_search_payout_requests(uuid,text,text,integer,integer) from public, anon, authenticated;
revoke all on function public.admin_search_escrow_transactions(uuid,text,text,integer,integer) from public, anon, authenticated;
revoke all on function public.admin_search_audit_logs(uuid,text,text,integer,integer) from public, anon, authenticated;
revoke all on function public.admin_create_seller_payout(uuid,uuid,uuid,timestamp with time zone) from public, anon, authenticated;
revoke all on function public.admin_cancel_seller_payout(uuid,uuid,text) from public, anon, authenticated;

grant execute on function public.admin_get_financial_operations_summary(uuid) to service_role;
grant execute on function public.admin_search_financial_transactions(uuid,text,text,text,integer,integer) to service_role;
grant execute on function public.admin_search_payout_requests(uuid,text,text,integer,integer) to service_role;
grant execute on function public.admin_search_escrow_transactions(uuid,text,text,integer,integer) to service_role;
grant execute on function public.admin_search_audit_logs(uuid,text,text,integer,integer) to service_role;
grant execute on function public.admin_create_seller_payout(uuid,uuid,uuid,timestamp with time zone) to service_role;
grant execute on function public.admin_cancel_seller_payout(uuid,uuid,text) to service_role;

commit;
