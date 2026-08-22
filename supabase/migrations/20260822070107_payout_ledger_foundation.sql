-- EntizNetStore provider-neutral seller payout ledger.
--
-- External payout processors are adapters. The marketplace owns escrow claims,
-- idempotency, payout state, provider-event replay protection and audit state.
-- No processor credentials or payout destination secrets are stored here.

create table public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles_seller(id) on delete restrict,
  idempotency_key uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'succeeded', 'failed', 'cancelled')),
  currency text not null default 'usd' check (currency = 'usd'),
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  provider text,
  provider_payout_id text,
  failure_code text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (seller_id, idempotency_key)
);

create index idx_payout_requests_seller_created
  on public.payout_requests(seller_id, created_at desc);

create index idx_payout_requests_status
  on public.payout_requests(status, created_at);

create unique index idx_payout_requests_provider_reference
  on public.payout_requests(provider, provider_payout_id)
  where provider is not null and provider_payout_id is not null;

create table public.payout_items (
  id uuid primary key default gen_random_uuid(),
  payout_request_id uuid not null references public.payout_requests(id) on delete restrict,
  escrow_transaction_id uuid not null references public.escrow_transactions(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'reserved'
    check (status in ('reserved', 'settled', 'released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payout_request_id, escrow_transaction_id)
);

create index idx_payout_items_request
  on public.payout_items(payout_request_id, status);

create index idx_payout_items_escrow
  on public.payout_items(escrow_transaction_id);

-- A held escrow row can belong to only one active/successful payout at a time.
-- Failed/cancelled requests mark their items `released`, allowing a later retry
-- without deleting financial history.
create unique index idx_payout_items_active_escrow
  on public.payout_items(escrow_transaction_id)
  where status in ('reserved', 'settled');

create table public.payout_provider_events (
  provider text not null,
  event_id text not null,
  event_type text not null,
  payout_request_id uuid references public.payout_requests(id) on delete restrict,
  outcome text not null
    check (outcome in ('succeeded', 'retryable_failure', 'terminal_failure', 'cancelled')),
  processed_at timestamptz not null default now(),
  primary key (provider, event_id)
);

create index idx_payout_provider_events_request
  on public.payout_provider_events(payout_request_id, processed_at desc);

alter table public.payout_requests enable row level security;
alter table public.payout_items enable row level security;
alter table public.payout_provider_events enable row level security;

create policy payout_requests_select_own
  on public.payout_requests
  for select
  to authenticated
  using ((select auth.uid()) = seller_id);

create policy payout_items_select_own
  on public.payout_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.payout_requests pr
      where pr.id = payout_items.payout_request_id
        and pr.seller_id = (select auth.uid())
    )
  );

-- Explicit Data API privilege contract. Sellers may read only through RLS;
-- all payout writes and provider events are trusted-server operations.
revoke all on table public.payout_requests from public, anon, authenticated;
revoke all on table public.payout_items from public, anon, authenticated;
revoke all on table public.payout_provider_events from public, anon, authenticated;

grant select on table public.payout_requests to authenticated;
grant select on table public.payout_items to authenticated;

grant select, insert, update, delete on table public.payout_requests to service_role;
grant select, insert, update, delete on table public.payout_items to service_role;
grant select, insert, update, delete on table public.payout_provider_events to service_role;

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
set search_path = pg_catalog, public
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

  -- Exact retry returns the durable request. A concurrent identical insert will
  -- wait on the unique key and then follow this same path.
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

  -- Lock eligible escrow rows before claiming them. SKIP LOCKED means a second
  -- payout request cannot wait and then reuse rows another transaction already
  -- selected. The partial unique index is a second line of defense.
  for v_escrow in
    select e.id, e.amount_cents
    from public.escrow_transactions e
    join public.orders o on o.id = e.order_id
    where e.seller_id = p_seller_id
      and e.status = 'held'
      and e.dispute_id is null
      and e.amount_cents > 0
      and o.seller_id = p_seller_id
      and o.status = 'delivered'
      and o.payment_status = 'paid'
      and o.fulfillment_status = 'fulfilled'
      and o.delivered_at is not null
      and o.delivered_at <= p_eligible_before
      and not exists (
        select 1
        from public.payout_items pi
        where pi.escrow_transaction_id = e.id
          and pi.status in ('reserved', 'settled')
      )
    order by e.created_at, e.id
    for update of e skip locked
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
    raise exception 'No eligible escrow balance is available for payout'
      using errcode = 'P0001';
  end if;

  update public.payout_requests
  set amount_cents = v_total,
      metadata = metadata || jsonb_build_object(
        'eligibility_cutoff', p_eligible_before,
        'ledger_version', 1
      ),
      updated_at = now()
  where id = v_request_id;

  return query select v_request_id, v_total, 'pending'::text;
end;
$$;

create or replace function public.attach_seller_payout_provider_reference(
  p_payout_request_id uuid,
  p_provider text,
  p_provider_payout_id text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_provider text := lower(btrim(p_provider));
  v_provider_payout_id text := btrim(p_provider_payout_id);
  v_request public.payout_requests%rowtype;
begin
  if v_provider !~ '^[a-z0-9][a-z0-9_-]{1,31}$' then
    raise exception 'Invalid payout provider' using errcode = '22023';
  end if;

  if nullif(v_provider_payout_id, '') is null or length(v_provider_payout_id) > 255 then
    raise exception 'Invalid provider payout identifier' using errcode = '22023';
  end if;

  select * into v_request
  from public.payout_requests
  where id = p_payout_request_id
  for update;

  if not found then
    raise exception 'Payout request not found' using errcode = '22023';
  end if;

  if v_request.status not in ('pending', 'processing') then
    raise exception 'Payout request is not attachable in status %', v_request.status
      using errcode = '22023';
  end if;

  if v_request.provider is not null and v_request.provider is distinct from v_provider then
    raise exception 'Payout provider conflicts with existing request'
      using errcode = '22023';
  end if;

  if v_request.provider_payout_id is not null
     and v_request.provider_payout_id is distinct from v_provider_payout_id then
    raise exception 'Provider payout identifier conflicts with existing request'
      using errcode = '22023';
  end if;

  update public.payout_requests
  set provider = v_provider,
      provider_payout_id = v_provider_payout_id,
      status = 'processing',
      updated_at = now()
  where id = p_payout_request_id;
end;
$$;

create or replace function public.cancel_seller_payout_request(
  p_payout_request_id uuid,
  p_reason text default 'operator_cancelled'
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_request public.payout_requests%rowtype;
  v_reason text := left(coalesce(nullif(btrim(p_reason), ''), 'operator_cancelled'), 500);
begin
  select * into v_request
  from public.payout_requests
  where id = p_payout_request_id
  for update;

  if not found then
    raise exception 'Payout request not found' using errcode = '22023';
  end if;

  if v_request.status = 'succeeded' then
    raise exception 'Succeeded payout cannot be cancelled' using errcode = '22023';
  end if;

  if v_request.status in ('failed', 'cancelled') then
    return true;
  end if;

  update public.payout_requests
  set status = 'cancelled',
      failure_code = 'operator_cancelled',
      failure_message = v_reason,
      completed_at = now(),
      updated_at = now()
  where id = p_payout_request_id;

  update public.payout_items
  set status = 'released', updated_at = now()
  where payout_request_id = p_payout_request_id
    and status = 'reserved';

  return true;
end;
$$;

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
set search_path = pg_catalog, public
as $$
declare
  v_provider text := lower(btrim(p_provider));
  v_event_id text := btrim(p_event_id);
  v_event_type text := btrim(p_event_type);
  v_provider_payout_id text := btrim(p_provider_payout_id);
  v_outcome text := lower(btrim(p_outcome));
  v_request public.payout_requests%rowtype;
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
    provider,
    event_id,
    event_type,
    payout_request_id,
    outcome
  )
  values (
    v_provider,
    v_event_id,
    v_event_type,
    p_payout_request_id,
    v_outcome
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

    if exists (
      select 1
      from public.payout_items pi
      join public.escrow_transactions e on e.id = pi.escrow_transaction_id
      where pi.payout_request_id = p_payout_request_id
        and pi.status = 'reserved'
        and (e.status <> 'held' or e.dispute_id is not null)
    ) then
      raise exception 'Payout escrow changed before settlement; manual reconciliation required'
        using errcode = '22023';
    end if;

    if not exists (
      select 1
      from public.payout_items pi
      where pi.payout_request_id = p_payout_request_id
        and pi.status = 'reserved'
    ) then
      raise exception 'Payout has no reserved escrow items'
        using errcode = '22023';
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
    -- A late failure/cancellation must never downgrade already-settled money.
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

-- All mutation RPCs are trusted-server-only. The public API never lets a seller
-- choose another seller_id, eligibility cutoff, provider result or payout state.
revoke all on function public.request_seller_payout(uuid, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.attach_seller_payout_provider_reference(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.cancel_seller_payout_request(uuid, text)
  from public, anon, authenticated;
revoke all on function public.finalize_seller_payout_v1(text, text, text, uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.request_seller_payout(uuid, uuid, timestamptz)
  to service_role;
grant execute on function public.attach_seller_payout_provider_reference(uuid, text, text)
  to service_role;
grant execute on function public.cancel_seller_payout_request(uuid, text)
  to service_role;
grant execute on function public.finalize_seller_payout_v1(text, text, text, uuid, text, text)
  to service_role;
