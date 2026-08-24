-- EntizNetStore combined M3 — provider-neutral refund and dispute operations.
--
-- Refund intent/approval is marketplace-owned. Actual money movement is confirmed
-- only by a trusted payment-provider adapter. Refund execution fails closed once
-- Seller escrow has been reserved/settled into a payout because post-payout
-- clawback requires a separate recovery ledger; we never fake that recovery.

begin;

create table public.order_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  raised_by uuid not null references auth.users(id) on delete restrict,
  raised_by_role text not null check (raised_by_role in ('buyer','seller','admin')),
  reason_code text not null check (reason_code in (
    'item_not_received','item_not_as_described','damaged','unauthorized','refund_issue','other'
  )),
  details text,
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in (
    'open','under_review','resolved_buyer','resolved_seller','closed'
  )),
  assigned_admin_id uuid references auth.users(id) on delete set null,
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_disputes_details_length_check check (details is null or char_length(details) <= 10000),
  constraint order_disputes_resolution_length_check check (resolution_notes is null or char_length(resolution_notes) <= 10000)
);

create unique index order_disputes_one_active_per_order
  on public.order_disputes(order_id)
  where status in ('open','under_review');
create index idx_order_disputes_status_created on public.order_disputes(status, created_at desc);
create index idx_order_disputes_order_created on public.order_disputes(order_id, created_at desc);
create index idx_order_disputes_raised_by_created on public.order_disputes(raised_by, created_at desc);

create table public.order_dispute_events (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.order_disputes(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  actor_type text not null check (actor_type in ('buyer','seller','admin','system')),
  action text not null check (action in (
    'opened','under_review','evidence_added','resolved_buyer','resolved_seller','closed'
  )),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint order_dispute_events_notes_length_check check (notes is null or char_length(notes) <= 10000)
);
create index idx_order_dispute_events_dispute_created
  on public.order_dispute_events(dispute_id, created_at desc);

create table public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  buyer_id uuid not null references public.profiles_buyer(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  requester_role text not null check (requester_role in ('buyer','admin')),
  dispute_id uuid references public.order_disputes(id) on delete set null,
  idempotency_key uuid not null default gen_random_uuid(),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'usd' check (currency = 'usd'),
  reason text not null,
  status text not null default 'requested' check (status in (
    'requested','approved','rejected','processing','succeeded','failed','cancelled'
  )),
  admin_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  payment_provider text,
  provider_refund_id text,
  failure_code text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint refund_requests_reason_length_check check (char_length(reason) between 1 and 5000),
  constraint refund_requests_admin_notes_length_check check (admin_notes is null or char_length(admin_notes) <= 10000),
  unique (buyer_id, idempotency_key)
);

create unique index refund_requests_one_active_per_order
  on public.refund_requests(order_id)
  where status in ('requested','approved','processing');
create unique index idx_refund_requests_provider_reference
  on public.refund_requests(payment_provider, provider_refund_id)
  where payment_provider is not null and provider_refund_id is not null;
create index idx_refund_requests_status_created on public.refund_requests(status, created_at desc);
create index idx_refund_requests_order_created on public.refund_requests(order_id, created_at desc);
create index idx_refund_requests_buyer_created on public.refund_requests(buyer_id, created_at desc);

create table public.refund_provider_events (
  provider text not null,
  event_id text not null,
  event_type text not null,
  refund_request_id uuid references public.refund_requests(id) on delete restrict,
  outcome text not null check (outcome in ('succeeded','retryable_failure','terminal_failure','cancelled')),
  processed_at timestamptz not null default now(),
  primary key (provider, event_id)
);
create index idx_refund_provider_events_request
  on public.refund_provider_events(refund_request_id, processed_at desc);

-- Existing escrow.dispute_id becomes a real FK now that the canonical dispute
-- ledger exists. The live Store currently has no transaction rows, but the
-- forward migration is safe for future populated environments as well.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.escrow_transactions'::regclass
      and conname = 'escrow_transactions_dispute_id_fkey'
  ) then
    alter table public.escrow_transactions
      add constraint escrow_transactions_dispute_id_fkey
      foreign key (dispute_id) references public.order_disputes(id) on delete set null;
  end if;
end
$$;
create index if not exists idx_escrow_transactions_dispute_id
  on public.escrow_transactions(dispute_id)
  where dispute_id is not null;

alter table public.order_disputes enable row level security;
alter table public.order_dispute_events enable row level security;
alter table public.refund_requests enable row level security;
alter table public.refund_provider_events enable row level security;

create policy order_disputes_participant_select
on public.order_disputes for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_disputes.order_id
    and ((select auth.uid()) = o.buyer_id or (select auth.uid()) = o.seller_id)
));

create policy order_dispute_events_participant_select
on public.order_dispute_events for select to authenticated
using (exists (
  select 1
  from public.order_disputes d
  join public.orders o on o.id = d.order_id
  where d.id = order_dispute_events.dispute_id
    and ((select auth.uid()) = o.buyer_id or (select auth.uid()) = o.seller_id)
));

create policy refund_requests_participant_select
on public.refund_requests for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = refund_requests.order_id
    and ((select auth.uid()) = o.buyer_id or (select auth.uid()) = o.seller_id)
));

revoke all on public.order_disputes, public.order_dispute_events,
  public.refund_requests, public.refund_provider_events
  from public, anon, authenticated;
grant select on public.order_disputes, public.order_dispute_events, public.refund_requests
  to authenticated;
grant all on public.order_disputes, public.order_dispute_events,
  public.refund_requests, public.refund_provider_events
  to service_role;

create or replace function public.open_order_dispute(
  p_order_id uuid,
  p_reason_code text,
  p_details text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.orders%rowtype;
  v_role text;
  v_dispute_id uuid;
  v_reason text := lower(btrim(coalesce(p_reason_code, '')));
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if v_reason not in ('item_not_received','item_not_as_described','damaged','unauthorized','refund_issue','other') then
    raise exception 'invalid_dispute_reason' using errcode = '22023';
  end if;
  if char_length(coalesce(v_details, '')) > 10000 then
    raise exception 'dispute_details_too_long' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = '22023';
  end if;
  if v_actor = v_order.buyer_id then v_role := 'buyer';
  elsif v_actor = v_order.seller_id then v_role := 'seller';
  else raise exception 'order_participant_required' using errcode = '42501';
  end if;
  if v_order.payment_status not in ('paid','partially_refunded') then
    raise exception 'paid_order_required_for_dispute' using errcode = '22023';
  end if;
  if exists (select 1 from public.order_disputes where order_id = p_order_id and status in ('open','under_review')) then
    raise exception 'active_order_dispute_exists' using errcode = '23505';
  end if;

  insert into public.order_disputes(order_id, raised_by, raised_by_role, reason_code, details)
  values (p_order_id, v_actor, v_role, v_reason, v_details)
  returning id into v_dispute_id;

  insert into public.order_dispute_events(dispute_id, actor_id, actor_type, action, notes)
  values (v_dispute_id, v_actor, v_role, 'opened', v_details);

  -- A dispute immediately prevents an unclaimed held escrow from being selected
  -- for a new payout request.
  update public.escrow_transactions
  set dispute_id = v_dispute_id, updated_at = now()
  where order_id = p_order_id and status = 'held';

  return v_dispute_id;
end;
$$;

revoke all on function public.open_order_dispute(uuid,text,text) from public, anon;
grant execute on function public.open_order_dispute(uuid,text,text) to authenticated, service_role;

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
    select 1 from auth.users u where u.id = p_admin_id and u.raw_app_meta_data->>'role' = 'admin'
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

  select * into v_dispute from public.order_disputes where id = p_dispute_id for update;
  if not found then raise exception 'dispute_not_found' using errcode = '22023'; end if;
  if v_dispute.status = 'closed' then
    raise exception 'dispute_already_closed' using errcode = '22023';
  end if;
  if v_dispute.status in ('resolved_buyer','resolved_seller') and v_next <> 'closed' then
    raise exception 'resolved_dispute_can_only_close' using errcode = '22023';
  end if;

  update public.order_disputes
  set status = v_next,
      assigned_admin_id = p_admin_id,
      resolution_notes = case when v_next in ('resolved_buyer','resolved_seller','closed') then v_notes else resolution_notes end,
      resolved_at = case when v_next in ('resolved_buyer','resolved_seller','closed') then coalesce(resolved_at, now()) else resolved_at end,
      updated_at = now()
  where id = p_dispute_id;

  insert into public.order_dispute_events(dispute_id, actor_id, actor_type, action, notes)
  values (p_dispute_id, p_admin_id, 'admin', v_next, v_notes);

  -- Seller-favoring resolution/closure releases the dispute hold. Buyer-favoring
  -- resolution keeps escrow frozen until the approved refund succeeds.
  if v_next in ('resolved_seller','closed') then
    update public.escrow_transactions
    set dispute_id = null, updated_at = now()
    where order_id = v_dispute.order_id and dispute_id = p_dispute_id;
  end if;

  insert into public.admin_audit_logs(admin_id, action, target_type, target_id, metadata, timestamp, created_at)
  values (
    p_admin_id, 'order_dispute_' || v_next, 'order_dispute', p_dispute_id::text,
    jsonb_build_object('order_id', v_dispute.order_id, 'status', v_next, 'notes', v_notes),
    now(), now()
  );
end;
$$;

revoke all on function public.admin_transition_order_dispute(uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.admin_transition_order_dispute(uuid,uuid,text,text)
  to service_role;

create or replace function public.buyer_request_order_refund(
  p_order_id uuid,
  p_amount_cents bigint,
  p_reason text,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_buyer uuid := auth.uid();
  v_order public.orders%rowtype;
  v_existing uuid;
  v_refunded bigint;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_dispute_id uuid;
begin
  if v_buyer is null then raise exception 'authentication_required' using errcode = '28000'; end if;
  if p_idempotency_key is null then raise exception 'idempotency_key_required' using errcode = '22023'; end if;
  if v_reason is null or char_length(v_reason) > 5000 then raise exception 'invalid_refund_reason' using errcode = '22023'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.buyer_id <> v_buyer then
    raise exception 'buyer_order_not_found_or_access_denied' using errcode = '42501';
  end if;
  if v_order.payment_status not in ('paid','partially_refunded') then
    raise exception 'paid_order_required_for_refund' using errcode = '22023';
  end if;

  select id into v_existing from public.refund_requests
  where buyer_id = v_buyer and idempotency_key = p_idempotency_key;
  if v_existing is not null then return v_existing; end if;

  select coalesce(sum(amount_cents),0)::bigint into v_refunded
  from public.refund_requests
  where order_id = p_order_id and status = 'succeeded';

  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > v_order.total_cents - v_refunded then
    raise exception 'invalid_refund_amount' using errcode = '22023';
  end if;
  if exists (select 1 from public.refund_requests where order_id = p_order_id and status in ('requested','approved','processing')) then
    raise exception 'active_refund_request_exists' using errcode = '23505';
  end if;

  select id into v_dispute_id from public.order_disputes
  where order_id = p_order_id and status in ('open','under_review','resolved_buyer')
  order by created_at desc limit 1;

  insert into public.refund_requests(
    order_id, buyer_id, requested_by, requester_role, dispute_id,
    idempotency_key, amount_cents, reason
  ) values (
    p_order_id, v_buyer, v_buyer, 'buyer', v_dispute_id,
    p_idempotency_key, p_amount_cents, v_reason
  ) returning id into v_existing;

  return v_existing;
end;
$$;

revoke all on function public.buyer_request_order_refund(uuid,bigint,text,uuid) from public, anon;
grant execute on function public.buyer_request_order_refund(uuid,bigint,text,uuid)
  to authenticated, service_role;

create or replace function public.admin_review_refund_request(
  p_admin_id uuid,
  p_refund_request_id uuid,
  p_decision text,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_refund public.refund_requests%rowtype;
  v_order public.orders%rowtype;
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_refunded bigint;
  v_payout_blocked boolean;
begin
  if p_admin_id is null or not exists (
    select 1 from auth.users u where u.id = p_admin_id and u.raw_app_meta_data->>'role' = 'admin'
  ) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;
  if v_decision not in ('approved','rejected') then raise exception 'invalid_refund_decision' using errcode = '22023'; end if;
  if v_decision = 'rejected' and v_notes is null then raise exception 'refund_rejection_notes_required' using errcode = '22023'; end if;
  if char_length(coalesce(v_notes, '')) > 10000 then raise exception 'refund_admin_notes_too_long' using errcode = '22023'; end if;

  select * into v_refund from public.refund_requests where id = p_refund_request_id for update;
  if not found then raise exception 'refund_request_not_found' using errcode = '22023'; end if;
  if v_refund.status <> 'requested' then raise exception 'refund_request_not_reviewable' using errcode = '22023'; end if;
  select * into v_order from public.orders where id = v_refund.order_id for update;

  select coalesce(sum(amount_cents),0)::bigint into v_refunded
  from public.refund_requests where order_id = v_refund.order_id and status = 'succeeded';
  if v_decision = 'approved' and v_refund.amount_cents > v_order.total_cents - v_refunded then
    raise exception 'refund_amount_exceeds_remaining_paid_amount' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.escrow_transactions e
    join public.payout_items pi on pi.escrow_transaction_id = e.id
    where e.order_id = v_refund.order_id and pi.status in ('reserved','settled')
  ) into v_payout_blocked;

  update public.refund_requests
  set status = v_decision,
      admin_notes = v_notes,
      reviewed_by = p_admin_id,
      reviewed_at = now(),
      metadata = metadata || jsonb_build_object(
        'provider_execution_blocked', case when v_payout_blocked then 'seller_payout_claim_exists' else null end
      ),
      updated_at = now()
  where id = p_refund_request_id;

  insert into public.admin_audit_logs(admin_id, action, target_type, target_id, metadata, timestamp, created_at)
  values (
    p_admin_id, 'refund_request_' || v_decision, 'refund_request', p_refund_request_id::text,
    jsonb_build_object('order_id', v_refund.order_id, 'amount_cents', v_refund.amount_cents, 'notes', v_notes, 'payout_blocked', v_payout_blocked),
    now(), now()
  );
end;
$$;

revoke all on function public.admin_review_refund_request(uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.admin_review_refund_request(uuid,uuid,text,text)
  to service_role;

create or replace function public.attach_refund_provider_reference(
  p_refund_request_id uuid,
  p_provider text,
  p_provider_refund_id text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_refund public.refund_requests%rowtype;
  v_provider text := lower(btrim(coalesce(p_provider, '')));
  v_ref text := btrim(coalesce(p_provider_refund_id, ''));
begin
  if v_provider !~ '^[a-z0-9][a-z0-9_-]{1,31}$' then raise exception 'invalid_refund_provider' using errcode = '22023'; end if;
  if v_ref = '' or char_length(v_ref) > 255 then raise exception 'invalid_provider_refund_id' using errcode = '22023'; end if;

  select * into v_refund from public.refund_requests where id = p_refund_request_id for update;
  if not found then raise exception 'refund_request_not_found' using errcode = '22023'; end if;
  if v_refund.status not in ('approved','processing') then raise exception 'refund_request_not_approved' using errcode = '22023'; end if;

  if exists (
    select 1 from public.escrow_transactions e
    join public.payout_items pi on pi.escrow_transaction_id = e.id
    where e.order_id = v_refund.order_id and pi.status in ('reserved','settled')
  ) then
    raise exception 'refund_blocked_by_seller_payout_claim' using errcode = '55000';
  end if;
  if not exists (
    select 1 from public.escrow_transactions e
    where e.order_id = v_refund.order_id and e.status = 'held'
  ) then
    raise exception 'refundable_held_escrow_required' using errcode = '55000';
  end if;

  update public.refund_requests
  set status = 'processing', payment_provider = v_provider,
      provider_refund_id = v_ref, failure_code = null, failure_message = null,
      updated_at = now()
  where id = p_refund_request_id
    and (payment_provider is null or payment_provider = v_provider)
    and (provider_refund_id is null or provider_refund_id = v_ref);

  if not found then raise exception 'refund_provider_reference_conflict' using errcode = '23505'; end if;
end;
$$;

revoke all on function public.attach_refund_provider_reference(uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.attach_refund_provider_reference(uuid,text,text)
  to service_role;

create or replace function public.finalize_refund_v1(
  p_event_id text,
  p_event_type text,
  p_refund_request_id uuid,
  p_provider text,
  p_provider_refund_id text,
  p_outcome text,
  p_failure_code text,
  p_failure_message text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_provider text := lower(btrim(coalesce(p_provider, '')));
  v_ref_id text := btrim(coalesce(p_provider_refund_id, ''));
  v_outcome text := lower(btrim(coalesce(p_outcome, '')));
  v_refund public.refund_requests%rowtype;
  v_order public.orders%rowtype;
  v_escrow public.escrow_transactions%rowtype;
  v_previous_refunded bigint;
  v_new_total_refunded bigint;
  v_platform_fee bigint;
  v_seller_original bigint;
  v_previous_seller_refunded bigint;
  v_target_seller_refunded bigint;
  v_seller_delta bigint;
  v_platform_refunded bigint;
begin
  if nullif(btrim(coalesce(p_event_id, '')), '') is null or nullif(btrim(coalesce(p_event_type, '')), '') is null then
    raise exception 'refund_event_required' using errcode = '22023';
  end if;
  if v_provider !~ '^[a-z0-9][a-z0-9_-]{1,31}$' or v_ref_id = '' then
    raise exception 'refund_provider_reference_required' using errcode = '22023';
  end if;
  if v_outcome not in ('succeeded','retryable_failure','terminal_failure','cancelled') then
    raise exception 'invalid_refund_outcome' using errcode = '22023';
  end if;

  select * into v_refund from public.refund_requests where id = p_refund_request_id for update;
  if not found then raise exception 'refund_request_not_found' using errcode = '22023'; end if;
  if v_refund.payment_provider is distinct from v_provider or v_refund.provider_refund_id is distinct from v_ref_id then
    raise exception 'refund_provider_reference_mismatch' using errcode = '22023';
  end if;

  insert into public.refund_provider_events(provider,event_id,event_type,refund_request_id,outcome)
  values (v_provider,btrim(p_event_id),btrim(p_event_type),p_refund_request_id,v_outcome)
  on conflict do nothing;
  if not found then return false; end if;

  if v_outcome = 'succeeded' then
    if v_refund.status = 'succeeded' then return true; end if;
    if v_refund.status <> 'processing' then raise exception 'refund_not_processing' using errcode = '22023'; end if;

    select * into v_order from public.orders where id = v_refund.order_id for update;
    select * into v_escrow from public.escrow_transactions where order_id = v_refund.order_id for update;
    if not found or v_escrow.status <> 'held' then raise exception 'refundable_held_escrow_required' using errcode = '55000'; end if;
    if exists (
      select 1 from public.payout_items pi
      where pi.escrow_transaction_id = v_escrow.id and pi.status in ('reserved','settled')
    ) then raise exception 'refund_blocked_by_seller_payout_claim' using errcode = '55000'; end if;

    select coalesce(sum(amount_cents),0)::bigint into v_previous_refunded
    from public.refund_requests
    where order_id = v_order.id and status = 'succeeded' and id <> v_refund.id;
    v_new_total_refunded := v_previous_refunded + v_refund.amount_cents;
    if v_new_total_refunded > v_order.total_cents then raise exception 'refund_exceeds_order_total' using errcode = '22023'; end if;

    v_platform_fee := coalesce(nullif(v_order.metadata->>'platform_fee_cents','')::bigint, round(v_order.total_cents * 0.10)::bigint);
    v_seller_original := v_order.total_cents - v_platform_fee;
    v_previous_seller_refunded := coalesce(nullif(v_order.metadata->>'seller_refunded_cents','')::bigint, 0);
    v_target_seller_refunded := case
      when v_new_total_refunded = v_order.total_cents then v_seller_original
      else round((v_new_total_refunded::numeric * v_seller_original::numeric) / v_order.total_cents::numeric)::bigint
    end;
    v_seller_delta := greatest(v_target_seller_refunded - v_previous_seller_refunded, 0);
    if v_seller_delta > v_escrow.amount_cents then raise exception 'refund_seller_reversal_exceeds_held_escrow' using errcode = '55000'; end if;
    v_platform_refunded := v_new_total_refunded - v_target_seller_refunded;

    update public.escrow_transactions
    set amount_cents = amount_cents - v_seller_delta,
        status = case when amount_cents - v_seller_delta = 0 then 'refunded' else 'held' end,
        release_reason = case when amount_cents - v_seller_delta = 0 then 'Customer refund completed' else release_reason end,
        updated_at = now()
    where id = v_escrow.id;

    update public.orders
    set payment_status = case when v_new_total_refunded = total_cents then 'refunded' else 'partially_refunded' end,
        status = case when v_new_total_refunded = total_cents then 'refunded' else status end,
        metadata = metadata || jsonb_build_object(
          'refunded_cents', v_new_total_refunded,
          'seller_refunded_cents', v_target_seller_refunded,
          'platform_fee_refunded_cents', v_platform_refunded
        ),
        updated_at = now()
    where id = v_order.id;

    update public.refund_requests
    set status = 'succeeded', failure_code = null, failure_message = null,
        completed_at = now(), updated_at = now()
    where id = v_refund.id;

    if v_refund.dispute_id is not null then
      update public.order_disputes
      set status = 'closed', resolved_at = coalesce(resolved_at, now()), updated_at = now()
      where id = v_refund.dispute_id and status = 'resolved_buyer';
      update public.escrow_transactions
      set dispute_id = null, updated_at = now()
      where id = v_escrow.id and dispute_id = v_refund.dispute_id;
      insert into public.order_dispute_events(dispute_id, actor_id, actor_type, action, notes, metadata)
      select v_refund.dispute_id, v_refund.reviewed_by, 'system', 'closed', 'Approved refund completed',
        jsonb_build_object('refund_request_id', v_refund.id)
      where exists (select 1 from public.order_disputes where id = v_refund.dispute_id);
    end if;

    if v_refund.reviewed_by is not null then
      insert into public.admin_audit_logs(admin_id,action,target_type,target_id,metadata,timestamp,created_at)
      values (
        v_refund.reviewed_by,'refund_succeeded','refund_request',v_refund.id::text,
        jsonb_build_object('order_id',v_order.id,'refund_cents',v_refund.amount_cents,'seller_reversal_cents',v_seller_delta,'platform_fee_reversal_cents',v_platform_refunded),
        now(),now()
      );
    end if;
  elsif v_outcome = 'retryable_failure' then
    if v_refund.status = 'succeeded' then return true; end if;
    update public.refund_requests
    set failure_code = nullif(btrim(coalesce(p_failure_code,'')),''),
        failure_message = nullif(btrim(coalesce(p_failure_message,'')),''), updated_at = now()
    where id = v_refund.id and status = 'processing';
  else
    if v_refund.status = 'succeeded' then return true; end if;
    update public.refund_requests
    set status = case when v_outcome = 'cancelled' then 'cancelled' else 'failed' end,
        failure_code = nullif(btrim(coalesce(p_failure_code,'')),''),
        failure_message = nullif(btrim(coalesce(p_failure_message,'')),''),
        completed_at = now(), updated_at = now()
    where id = v_refund.id and status in ('approved','processing');
  end if;

  return true;
end;
$$;

revoke all on function public.finalize_refund_v1(text,text,uuid,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.finalize_refund_v1(text,text,uuid,text,text,text,text,text)
  to service_role;

commit;
