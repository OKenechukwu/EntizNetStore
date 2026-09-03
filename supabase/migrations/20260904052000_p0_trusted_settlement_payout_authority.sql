-- EntizNetStore P0 — trusted settlement authority for Seller payouts.
--
-- Fulfillment is operational evidence controlled by the Seller. It is never the
-- financial authority that unlocks the Seller's own escrow. Payout eligibility
-- begins only after an independently trusted confirmation (Buyer or verified
-- Admin), and reservation/finalization both fail closed around disputes/refunds.

begin;

create table public.order_settlement_confirmations (
  order_id uuid primary key references public.orders(id) on delete restrict,
  buyer_id uuid not null references public.profiles_buyer(id) on delete restrict,
  seller_id uuid not null references public.profiles_seller(id) on delete restrict,
  authority_type text not null check (authority_type in ('buyer','admin')),
  confirmed_by uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  confirmed_at timestamptz not null default now(),
  reason text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint order_settlement_confirmation_reason_length
    check (reason is null or char_length(reason) <= 2000),
  constraint order_settlement_confirmation_actor_key
    unique (authority_type, confirmed_by, idempotency_key)
);

create index idx_order_settlement_confirmations_seller_confirmed
  on public.order_settlement_confirmations(seller_id, confirmed_at desc);
create index idx_order_settlement_confirmations_buyer_confirmed
  on public.order_settlement_confirmations(buyer_id, confirmed_at desc);

alter table public.order_settlement_confirmations enable row level security;

create policy order_settlement_confirmation_participant_select
on public.order_settlement_confirmations for select to authenticated
using (
  (select auth.uid()) = buyer_id
  or (select auth.uid()) = seller_id
);

-- Browser and generic service-role callers cannot manufacture settlement proof.
-- Trusted confirmation is created only through the constrained functions below.
revoke all on table public.order_settlement_confirmations
  from public, anon, authenticated, service_role;
grant select on table public.order_settlement_confirmations to authenticated, service_role;

create or replace function private.stamp_order_settlement_confirmation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.confirmed_at := statement_timestamp();
  new.created_at := new.confirmed_at;
  return new;
end;
$$;

create trigger order_settlement_confirmation_stamp
before insert on public.order_settlement_confirmations
for each row execute function private.stamp_order_settlement_confirmation();

create or replace function private.reject_order_settlement_confirmation_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'settlement_confirmation_is_immutable' using errcode = '42501';
end;
$$;

create trigger order_settlement_confirmation_immutable
before update or delete on public.order_settlement_confirmations
for each row execute function private.reject_order_settlement_confirmation_mutation();

-- Serialize financial blockers with payout reservation/finalization even when a
-- trusted service writes a refund/dispute ledger directly instead of through the
-- higher-level RPC. This closes the "checked absence, then concurrent insert"
-- race around payout money movement.
create or replace function private.lock_order_for_financial_blocker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1
  from public.orders o
  where o.id = new.order_id
  for update;

  if not found then
    raise exception 'order_not_found' using errcode = '23503';
  end if;

  return new;
end;
$$;

create trigger refund_requests_serialize_with_payout
before insert or update of order_id, status on public.refund_requests
for each row execute function private.lock_order_for_financial_blocker();

create trigger order_disputes_serialize_with_payout
before insert or update of order_id, status on public.order_disputes
for each row execute function private.lock_order_for_financial_blocker();

-- Buyer receipt is the primary V1 settlement authority. The caller is derived
-- from auth.uid(); no Buyer/Seller/actor identifier is accepted from the client.
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
    select 1 from public.order_disputes d
    where d.order_id = p_order_id and d.status in ('open','under_review')
  ) then
    raise exception 'active_order_dispute_blocks_settlement' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.refund_requests r
    where r.order_id = p_order_id and r.status in ('requested','approved','processing')
  ) then
    raise exception 'active_refund_blocks_settlement' using errcode = '22023';
  end if;

  select c.order_id into v_confirmation_id
  from public.order_settlement_confirmations c
  where c.order_id = p_order_id;

  if v_confirmation_id is not null then
    return v_confirmation_id;
  end if;

  insert into public.order_settlement_confirmations(
    order_id, buyer_id, seller_id, authority_type, confirmed_by,
    idempotency_key, reason, metadata
  ) values (
    v_order.id, v_order.buyer_id, v_order.seller_id, 'buyer', v_actor,
    p_idempotency_key, 'buyer_confirmed_receipt',
    jsonb_build_object('order_number', v_order.order_number)
  )
  returning order_id into v_confirmation_id;

  insert into public.notifications(user_id, type, title, body, action_url, metadata)
  values (
    v_order.seller_id,
    'order',
    'Order receipt confirmed',
    'The Buyer confirmed receipt. Payout remains subject to the configured settlement hold and financial safety checks.',
    '/dashboard/orders',
    jsonb_build_object('order_id', v_order.id, 'event', 'buyer_receipt_confirmed')
  );

  return v_confirmation_id;
end;
$$;

create or replace function public.confirm_buyer_order_receipt(
  p_order_id uuid,
  p_idempotency_key uuid
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.confirm_buyer_order_receipt(p_order_id, p_idempotency_key);
$$;

-- Admin confirmation is an exceptional trusted fallback for independently
-- verified delivery. A reason is mandatory and an Admin audit row is immutable
-- evidence of who asserted settlement authority.
create or replace function private.confirm_admin_order_settlement(
  p_admin_id uuid,
  p_order_id uuid,
  p_reason text,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_order public.orders%rowtype;
  v_confirmation_id uuid;
  v_created boolean := false;
begin
  if p_admin_id is null or p_order_id is null or p_idempotency_key is null then
    raise exception 'admin_order_and_idempotency_key_required' using errcode = '22023';
  end if;
  if char_length(v_reason) < 5 or char_length(v_reason) > 2000 then
    raise exception 'admin_settlement_reason_required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from auth.users u
    where u.id = p_admin_id and u.raw_app_meta_data->>'role' = 'admin'
  ) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;

  select * into v_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found' using errcode = '22023';
  end if;
  if v_order.payment_status <> 'paid'
     or v_order.status <> 'delivered'
     or v_order.fulfillment_status <> 'fulfilled'
     or v_order.delivered_at is null then
    raise exception 'delivered_paid_order_required' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.order_disputes d
    where d.order_id = p_order_id and d.status in ('open','under_review')
  ) then
    raise exception 'active_order_dispute_blocks_settlement' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.refund_requests r
    where r.order_id = p_order_id and r.status in ('requested','approved','processing')
  ) then
    raise exception 'active_refund_blocks_settlement' using errcode = '22023';
  end if;

  select c.order_id into v_confirmation_id
  from public.order_settlement_confirmations c
  where c.order_id = p_order_id;

  if v_confirmation_id is null then
    insert into public.order_settlement_confirmations(
      order_id, buyer_id, seller_id, authority_type, confirmed_by,
      idempotency_key, reason, metadata
    ) values (
      v_order.id, v_order.buyer_id, v_order.seller_id, 'admin', p_admin_id,
      p_idempotency_key, v_reason,
      jsonb_build_object('order_number', v_order.order_number, 'manual_override', true)
    )
    returning order_id into v_confirmation_id;
    v_created := true;
  end if;

  if v_created then
    insert into public.admin_audit_logs(
      admin_id, action, target_type, target_id, metadata, timestamp, created_at
    ) values (
      p_admin_id,
      'order_settlement_confirmed',
      'order',
      p_order_id::text,
      jsonb_build_object(
        'authority_type', 'admin',
        'reason', v_reason,
        'settlement_confirmation_order_id', v_confirmation_id
      ),
      now(), now()
    );
  end if;

  return v_confirmation_id;
end;
$$;

create or replace function public.admin_confirm_order_settlement(
  p_admin_id uuid,
  p_order_id uuid,
  p_reason text,
  p_idempotency_key uuid
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.confirm_admin_order_settlement(
    p_admin_id, p_order_id, p_reason, p_idempotency_key
  );
$$;

-- Payout reservation now trusts the independent confirmation timestamp. Seller
-- fulfillment/delivered_at remains a necessary operational state but can never
-- be sufficient financial authority.
create or replace function public.request_seller_payout(
  p_seller_id uuid,
  p_idempotency_key uuid,
  p_eligible_before timestamptz
)
returns table(
  payout_request_id uuid,
  amount_cents bigint,
  payout_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
  v_existing_amount bigint;
  v_existing_status text;
  v_total bigint := 0;
  v_escrow record;
begin
  if p_seller_id is null or p_idempotency_key is null or p_eligible_before is null then
    raise exception 'Seller, idempotency key and eligibility cutoff are required'
      using errcode = '22023';
  end if;

  if p_eligible_before > now() then
    raise exception 'Payout eligibility cutoff cannot be in the future'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles_seller s
    where s.id = p_seller_id
      and s.verification_status = 'verified'
  ) then
    raise exception 'Verified seller profile required' using errcode = '42501';
  end if;

  select pr.id, pr.amount_cents, pr.status
    into v_request_id, v_existing_amount, v_existing_status
  from public.payout_requests pr
  where pr.seller_id = p_seller_id
    and pr.idempotency_key = p_idempotency_key
  for update;

  if found then
    return query select v_request_id, v_existing_amount, v_existing_status;
    return;
  end if;

  insert into public.payout_requests(seller_id, idempotency_key)
  values (p_seller_id, p_idempotency_key)
  on conflict (seller_id, idempotency_key) do nothing
  returning id into v_request_id;

  if v_request_id is null then
    select pr.id, pr.amount_cents, pr.status
      into v_request_id, v_existing_amount, v_existing_status
    from public.payout_requests pr
    where pr.seller_id = p_seller_id
      and pr.idempotency_key = p_idempotency_key
    for update;

    if v_request_id is null then
      raise exception 'Unable to resolve idempotent payout request';
    end if;

    return query select v_request_id, v_existing_amount, v_existing_status;
    return;
  end if;

  for v_escrow in
    select e.id, e.amount_cents, e.order_id, c.confirmed_at
    from public.escrow_transactions e
    join public.orders o on o.id = e.order_id
    join public.order_settlement_confirmations c on c.order_id = o.id
    where e.seller_id = p_seller_id
      and e.status = 'held'
      and e.dispute_id is null
      and e.amount_cents > 0
      and o.seller_id = p_seller_id
      and c.seller_id = p_seller_id
      and c.buyer_id = o.buyer_id
      and o.status = 'delivered'
      and o.payment_status = 'paid'
      and o.fulfillment_status = 'fulfilled'
      and o.delivered_at is not null
      and c.confirmed_at <= p_eligible_before
      and not exists (
        select 1 from public.order_disputes d
        where d.order_id = o.id and d.status in ('open','under_review')
      )
      and not exists (
        select 1 from public.refund_requests r
        where r.order_id = o.id and r.status in ('requested','approved','processing')
      )
      and not exists (
        select 1
        from public.payout_items pi
        where pi.escrow_transaction_id = e.id
          and pi.status in ('reserved', 'settled')
      )
    order by c.confirmed_at, e.created_at, e.id
    for update of e, o, c skip locked
  loop
    insert into public.payout_items(
      payout_request_id,
      escrow_transaction_id,
      amount_cents,
      status
    )
    values (
      v_request_id,
      v_escrow.id,
      v_escrow.amount_cents,
      'reserved'
    )
    on conflict do nothing;

    if found then
      v_total := v_total + v_escrow.amount_cents;
    end if;
  end loop;

  if v_total <= 0 then
    raise exception 'No trusted settlement-confirmed escrow balance is available for payout'
      using errcode = 'P0001';
  end if;

  update public.payout_requests
  set amount_cents = v_total,
      metadata = metadata || jsonb_build_object(
        'eligibility_cutoff', p_eligible_before,
        'ledger_version', 2,
        'eligibility_authority', 'trusted_settlement_confirmation'
      ),
      updated_at = now()
  where id = v_request_id;

  return query select v_request_id, v_total, 'pending'::text;
end;
$$;

-- Provider success is not enough by itself. Re-lock every reserved escrow and
-- its Order/confirmation, then re-evaluate all financial blockers immediately
-- before money changes state. Concurrent refund/dispute writes serialize on the
-- same Order lock through the triggers above.
create or replace function public.finalize_seller_payout_v1(
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_payout_request_id uuid,
  p_provider_payout_id text,
  p_outcome text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider text := lower(btrim(p_provider));
  v_event_id text := btrim(p_event_id);
  v_event_type text := btrim(p_event_type);
  v_provider_payout_id text := btrim(p_provider_payout_id);
  v_outcome text := lower(btrim(p_outcome));
  v_request public.payout_requests%rowtype;
  v_item record;
  v_order public.orders%rowtype;
  v_confirmation public.order_settlement_confirmations%rowtype;
  v_reserved_count integer := 0;
begin
  if v_provider !~ '^[a-z0-9][a-z0-9_-]{1,31}$'
     or nullif(v_event_id, '') is null
     or length(v_event_id) > 255
     or nullif(v_event_type, '') is null
     or length(v_event_type) > 255
     or nullif(v_provider_payout_id, '') is null
     or length(v_provider_payout_id) > 255 then
    raise exception 'Provider, event and payout identifiers are required'
      using errcode = '22023';
  end if;

  if v_outcome not in ('succeeded', 'retryable_failure', 'terminal_failure', 'cancelled') then
    raise exception 'Unsupported normalized payout outcome' using errcode = '22023';
  end if;

  select * into v_request
  from public.payout_requests
  where id = p_payout_request_id
  for update;

  if not found then
    raise exception 'Payout request not found' using errcode = '22023';
  end if;

  if v_request.provider is distinct from v_provider
     or v_request.provider_payout_id is distinct from v_provider_payout_id then
    raise exception 'Provider payout reference does not match payout request'
      using errcode = '22023';
  end if;

  insert into public.payout_provider_events(
    provider, event_id, event_type, payout_request_id, outcome
  ) values (
    v_provider, v_event_id, v_event_type, p_payout_request_id, v_outcome
  )
  on conflict (provider, event_id) do nothing;

  if not found then
    return false;
  end if;

  if v_outcome = 'succeeded' then
    if v_request.status = 'succeeded' then
      return true;
    end if;
    if v_request.status in ('failed', 'cancelled') then
      raise exception 'Late payout success requires manual reconciliation'
        using errcode = '22023';
    end if;
    if v_request.status <> 'processing' then
      raise exception 'Payout must be processing before success confirmation'
        using errcode = '22023';
    end if;

    for v_item in
      select pi.id as payout_item_id,
             e.id as escrow_id,
             e.order_id,
             e.status as escrow_status,
             e.dispute_id
      from public.payout_items pi
      join public.escrow_transactions e on e.id = pi.escrow_transaction_id
      where pi.payout_request_id = p_payout_request_id
        and pi.status = 'reserved'
      order by pi.id
      for update of pi, e
    loop
      v_reserved_count := v_reserved_count + 1;

      select * into v_order
      from public.orders o
      where o.id = v_item.order_id
      for update;

      if not found then
        raise exception 'Payout Order disappeared before settlement; manual reconciliation required'
          using errcode = '22023';
      end if;

      select * into v_confirmation
      from public.order_settlement_confirmations c
      where c.order_id = v_order.id
      for update;

      if not found
         or v_confirmation.seller_id <> v_request.seller_id
         or v_confirmation.buyer_id <> v_order.buyer_id
         or v_item.escrow_status <> 'held'
         or v_item.dispute_id is not null
         or v_order.seller_id <> v_request.seller_id
         or v_order.status <> 'delivered'
         or v_order.payment_status <> 'paid'
         or v_order.fulfillment_status <> 'fulfilled'
         or v_order.delivered_at is null then
        raise exception 'Payout settlement authority changed before provider success; manual reconciliation required'
          using errcode = '22023';
      end if;

      if exists (
        select 1 from public.order_disputes d
        where d.order_id = v_order.id and d.status in ('open','under_review')
      ) then
        raise exception 'Active Order dispute blocks payout finalization'
          using errcode = '22023';
      end if;

      if exists (
        select 1 from public.refund_requests r
        where r.order_id = v_order.id and r.status in ('requested','approved','processing')
      ) then
        raise exception 'Active refund blocks payout finalization'
          using errcode = '22023';
      end if;
    end loop;

    if v_reserved_count = 0 then
      raise exception 'Payout has no reserved escrow items' using errcode = '22023';
    end if;

    update public.escrow_transactions e
    set status = 'released',
        released_at = now(),
        release_reason = 'seller_payout:' || p_payout_request_id::text,
        updated_at = now()
    from public.payout_items pi
    where pi.payout_request_id = p_payout_request_id
      and pi.status = 'reserved'
      and pi.escrow_transaction_id = e.id
      and e.status = 'held'
      and e.dispute_id is null;

    update public.payout_items
    set status = 'settled', updated_at = now()
    where payout_request_id = p_payout_request_id
      and status = 'reserved';

    update public.payout_requests
    set status = 'succeeded',
        failure_code = null,
        failure_message = null,
        completed_at = now(),
        updated_at = now()
    where id = p_payout_request_id;

  elsif v_outcome = 'retryable_failure' then
    if v_request.status in ('succeeded', 'failed', 'cancelled') then
      return true;
    end if;

    update public.payout_requests
    set status = 'processing',
        failure_code = 'retryable_provider_failure',
        failure_message = 'Provider reported a retryable payout failure',
        metadata = jsonb_set(
          metadata,
          '{last_provider_event}',
          jsonb_build_object(
            'provider', v_provider,
            'event_id', v_event_id,
            'outcome', v_outcome,
            'recorded_at', now()
          ),
          true
        ),
        updated_at = now()
    where id = p_payout_request_id;

  else
    if v_request.status = 'succeeded' then
      return true;
    end if;
    if v_request.status in ('failed', 'cancelled') then
      return true;
    end if;

    update public.payout_requests
    set status = case when v_outcome = 'cancelled' then 'cancelled' else 'failed' end,
        failure_code = case
          when v_outcome = 'cancelled' then 'provider_cancelled'
          else 'terminal_provider_failure'
        end,
        failure_message = case
          when v_outcome = 'cancelled' then 'Provider cancelled the payout'
          else 'Provider reported a terminal payout failure'
        end,
        completed_at = now(),
        updated_at = now()
    where id = p_payout_request_id;

    update public.payout_items
    set status = 'released', updated_at = now()
    where payout_request_id = p_payout_request_id
      and status = 'reserved';
  end if;

  return true;
end;
$$;

-- Public wrappers use invoker semantics; privilege is explicit. Private definers
-- are not exposed as public Data API RPC surfaces.
revoke execute on function public.confirm_buyer_order_receipt(uuid, uuid)
  from public, anon;
grant execute on function public.confirm_buyer_order_receipt(uuid, uuid)
  to authenticated;

revoke execute on function public.admin_confirm_order_settlement(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_confirm_order_settlement(uuid, uuid, text, uuid)
  to service_role;

revoke execute on function private.confirm_buyer_order_receipt(uuid, uuid)
  from public, anon, service_role;
grant usage on schema private to authenticated;
grant execute on function private.confirm_buyer_order_receipt(uuid, uuid)
  to authenticated;

revoke execute on function private.confirm_admin_order_settlement(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.confirm_admin_order_settlement(uuid, uuid, text, uuid)
  to service_role;

revoke execute on function private.stamp_order_settlement_confirmation()
  from public, anon, authenticated, service_role;
revoke execute on function private.reject_order_settlement_confirmation_mutation()
  from public, anon, authenticated, service_role;
revoke execute on function private.lock_order_for_financial_blocker()
  from public, anon, authenticated, service_role;

revoke all on function public.request_seller_payout(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.request_seller_payout(uuid, uuid, timestamptz)
  to service_role;

revoke all on function public.finalize_seller_payout_v1(text, text, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.finalize_seller_payout_v1(text, text, text, uuid, text, text)
  to service_role;

comment on table public.order_settlement_confirmations is
  'Immutable trusted settlement evidence. Seller fulfillment cannot create or mutate this authority.';
comment on function public.request_seller_payout(uuid, uuid, timestamptz) is
  'Trusted payout reservation. Eligibility cutoff applies to independent settlement confirmation time, never Seller-delivered_at.';

commit;
