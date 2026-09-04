-- EntizNetStore P0 — settlement authority integration hardening.
--
-- Follow-up to the additive trusted-settlement foundation. This migration keeps
-- the hidden authority model intact while aligning it with the repository's
-- canonical notification schema and hardened public-function search_path
-- contract. No payout rule is relaxed here.

begin;

create or replace function private.confirm_buyer_order_receipt(
  p_order_id uuid,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.orders%rowtype;
  v_confirmation_id uuid;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_order_id is null or p_idempotency_key is null then
    raise exception 'order_and_idempotency_key_required' using errcode = '22023';
  end if;

  select * into v_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found' using errcode = '22023';
  end if;
  if v_order.buyer_id <> v_actor then
    raise exception 'buyer_order_authority_required' using errcode = '42501';
  end if;
  if v_order.payment_status <> 'paid'
     or v_order.status <> 'delivered'
     or v_order.fulfillment_status <> 'fulfilled'
     or v_order.delivered_at is null then
    raise exception 'delivered_paid_order_required' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.order_disputes d
    where d.order_id = p_order_id
      and d.status in ('open','under_review')
  ) then
    raise exception 'active_order_dispute_blocks_settlement' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.refund_requests r
    where r.order_id = p_order_id
      and r.status in ('requested','approved','processing')
  ) then
    raise exception 'active_refund_blocks_settlement' using errcode = '22023';
  end if;

  select c.order_id into v_confirmation_id
  from private.order_settlement_confirmations c
  where c.order_id = p_order_id;

  if v_confirmation_id is not null then
    return v_confirmation_id;
  end if;

  insert into private.order_settlement_confirmations(
    order_id,
    buyer_id,
    seller_id,
    authority_type,
    confirmed_by,
    idempotency_key,
    reason,
    metadata
  ) values (
    v_order.id,
    v_order.buyer_id,
    v_order.seller_id,
    'buyer',
    v_actor,
    p_idempotency_key,
    'buyer_confirmed_receipt',
    jsonb_build_object('order_number', v_order.order_number)
  )
  returning order_id into v_confirmation_id;

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
    v_order.seller_id,
    'order',
    'Order receipt confirmed',
    'The Buyer confirmed receipt. Payout remains subject to the configured settlement hold and financial safety checks.',
    false,
    '/dashboard/orders',
    jsonb_build_object(
      'order_id', v_order.id,
      'event', 'buyer_receipt_confirmed'
    ),
    now(),
    now()
  );

  return v_confirmation_id;
end;
$$;

-- Public wrappers keep an explicit, repository-approved search path. Their
-- implementation remains in the non-exposed private schema and is fully
-- schema-qualified, so no attacker-controlled schema lookup is introduced.
alter function public.confirm_buyer_order_receipt(uuid, uuid)
  set search_path = pg_catalog, public;
alter function public.get_order_settlement_confirmation(uuid)
  set search_path = pg_catalog, public;
alter function public.admin_confirm_order_settlement(uuid, uuid, text, uuid)
  set search_path = pg_catalog, public, auth;

-- These two service-only payout functions are part of the canonical marketplace
-- SECURITY DEFINER inventory. Preserve the approved path while continuing to
-- reference hidden settlement evidence through explicit schema qualification.
alter function public.request_seller_payout(uuid, uuid, timestamptz)
  set search_path = pg_catalog, public;
alter function public.finalize_seller_payout_v1(text, text, text, uuid, text, text)
  set search_path = pg_catalog, public;

-- PostgreSQL grants function EXECUTE to PUBLIC by default. Reassert the exact
-- callable surfaces after replacement/ALTER operations.
revoke all on function public.confirm_buyer_order_receipt(uuid, uuid)
  from public, anon;
grant execute on function public.confirm_buyer_order_receipt(uuid, uuid)
  to authenticated;
revoke all on function public.get_order_settlement_confirmation(uuid)
  from public, anon;
grant execute on function public.get_order_settlement_confirmation(uuid)
  to authenticated;
revoke all on function public.admin_confirm_order_settlement(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_confirm_order_settlement(uuid, uuid, text, uuid)
  to service_role;

revoke all on function public.request_seller_payout(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.request_seller_payout(uuid, uuid, timestamptz)
  to service_role;
revoke all on function public.finalize_seller_payout_v1(text, text, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.finalize_seller_payout_v1(text, text, text, uuid, text, text)
  to service_role;

commit;
