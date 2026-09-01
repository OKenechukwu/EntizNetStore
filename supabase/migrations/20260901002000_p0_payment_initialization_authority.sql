-- P0 payment initialization authority and duplicate-processor-call prevention.
--
-- External payment initialization is a trusted server operation. A Buyer may
-- choose/pay their own checkout, but must never be able to stamp arbitrary
-- provider references directly. Concurrent create-intent requests must
-- serialize before any external processor call so two provider payments cannot
-- be created for one checkout. Once an external call begins, any ambiguous
-- outcome remains reconciliation-locked instead of being auto-cancelled.

begin;

alter table public.payment_sessions
  add column if not exists payment_initialization_attempt_id uuid,
  add column if not exists payment_initialization_started_at timestamptz;

alter table public.payment_sessions
  add constraint payment_sessions_initialization_attempt_check
  check (
    (payment_initialization_attempt_id is null and payment_initialization_started_at is null)
    or
    (payment_initialization_attempt_id is not null and payment_initialization_started_at is not null)
  );

create unique index if not exists idx_payment_sessions_initialization_attempt
  on public.payment_sessions(payment_initialization_attempt_id)
  where payment_initialization_attempt_id is not null;

-- A provider reference is a money-movement identity. It must never identify two
-- local checkout sessions, otherwise webhook/reconciliation authority becomes
-- ambiguous. Production was verified clean before this forward invariant.
create unique index if not exists idx_payment_sessions_provider_reference_unique
  on public.payment_sessions(payment_provider, provider_payment_id)
  where payment_provider is not null and provider_payment_id is not null;

-- Retire the old direct provider-reference attachment surfaces. They remain in
-- the schema only for migration-history compatibility and receive no API-role
-- execution grant.
revoke all on function public.attach_checkout_payment_reference(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.attach_checkout_payment_intent(uuid, text)
  from public, anon, authenticated, service_role;

comment on function public.attach_checkout_payment_reference(uuid, text, text) is
  'Deprecated and non-executable. Provider references are bound only through the service payment-initialization authority.';
comment on function public.attach_checkout_payment_intent(uuid, text) is
  'Deprecated and non-executable Stripe compatibility wrapper.';

create or replace function public.service_claim_checkout_payment_initialization(
  p_session_id uuid,
  p_buyer_id uuid,
  p_attempt_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_session public.payment_sessions%rowtype;
  v_order_count integer;
begin
  if p_session_id is null or p_buyer_id is null or p_attempt_id is null then
    raise exception 'payment_initialization_identifiers_required' using errcode = '22023';
  end if;

  select * into v_session
  from public.payment_sessions
  where id = p_session_id
  for update;

  if not found or v_session.buyer_id <> p_buyer_id then
    raise exception 'checkout_session_not_found_or_access_denied' using errcode = '42501';
  end if;

  if not app_private.marketplace_capability_is_active(p_buyer_id, 'buyer') then
    raise exception 'buyer_capability_suspended' using errcode = '42501';
  end if;

  if v_session.status not in ('pending', 'requires_payment') then
    raise exception 'checkout_session_not_payable' using errcode = '22023';
  end if;

  if v_session.payment_provider is not null
     or v_session.provider_payment_id is not null
     or v_session.stripe_payment_intent_id is not null then
    raise exception 'payment_already_initialized' using errcode = '22023';
  end if;

  if v_session.payment_initialization_attempt_id is not null then
    if v_session.payment_initialization_attempt_id = p_attempt_id then
      return;
    end if;
    raise exception 'payment_initialization_already_claimed' using errcode = '55P03';
  end if;

  select count(*)::integer into v_order_count
  from public.orders o
  where o.payment_session_id = p_session_id;

  if v_order_count < 1
     or exists (
       select 1
       from public.orders o
       where o.payment_session_id = p_session_id
         and (
           o.buyer_id <> p_buyer_id
           or o.status <> 'pending'
           or o.payment_status <> 'pending'
         )
     ) then
    raise exception 'checkout_order_state_not_payable' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.inventory_reservations r
    where r.payment_session_id = p_session_id
      and r.status = 'pending'
  ) then
    raise exception 'checkout_inventory_reservation_missing' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.inventory_reservations r
    where r.payment_session_id = p_session_id
      and (
        r.status <> 'pending'
        or r.expires_at <= now()
      )
  ) then
    raise exception 'checkout_inventory_reservation_expired_or_changed' using errcode = '22023';
  end if;

  update public.payment_sessions
  set payment_initialization_attempt_id = p_attempt_id,
      payment_initialization_started_at = now(),
      metadata = metadata || jsonb_build_object(
        'payment_initialization_claimed', true,
        'payment_initialization_attempt_id', p_attempt_id
      ),
      updated_at = now()
  where id = p_session_id;
end;
$$;

revoke all on function public.service_claim_checkout_payment_initialization(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.service_claim_checkout_payment_initialization(uuid, uuid, uuid)
  to service_role;

create or replace function public.service_attach_checkout_payment_reference(
  p_session_id uuid,
  p_buyer_id uuid,
  p_attempt_id uuid,
  p_provider text,
  p_provider_payment_id text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_provider text := lower(btrim(p_provider));
  v_payment_id text := btrim(p_provider_payment_id);
  v_session public.payment_sessions%rowtype;
  v_order_count integer;
  v_updated integer;
begin
  if p_session_id is null or p_buyer_id is null or p_attempt_id is null then
    raise exception 'payment_initialization_identifiers_required' using errcode = '22023';
  end if;

  if v_provider !~ '^[a-z0-9][a-z0-9_-]{1,31}$' then
    raise exception 'invalid_payment_provider' using errcode = '22023';
  end if;

  if nullif(v_payment_id, '') is null or length(v_payment_id) > 255 then
    raise exception 'invalid_provider_payment_identifier' using errcode = '22023';
  end if;

  select * into v_session
  from public.payment_sessions
  where id = p_session_id
  for update;

  if not found or v_session.buyer_id <> p_buyer_id then
    raise exception 'checkout_session_not_found_or_access_denied' using errcode = '42501';
  end if;

  if v_session.payment_initialization_attempt_id is distinct from p_attempt_id
     or v_session.payment_initialization_started_at is null then
    raise exception 'payment_initialization_attempt_mismatch' using errcode = '42501';
  end if;

  if v_session.status not in ('pending', 'requires_payment') then
    raise exception 'checkout_session_not_payable' using errcode = '22023';
  end if;

  if v_session.payment_provider = v_provider
     and v_session.provider_payment_id = v_payment_id then
    return;
  end if;

  if v_session.payment_provider is not null
     or v_session.provider_payment_id is not null
     or (v_provider = 'stripe' and v_session.stripe_payment_intent_id is not null) then
    raise exception 'payment_reference_conflict' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.payment_sessions ps
    where ps.id <> p_session_id
      and ps.payment_provider = v_provider
      and ps.provider_payment_id = v_payment_id
  ) then
    raise exception 'provider_payment_reference_already_bound' using errcode = '23505';
  end if;

  select count(*)::integer into v_order_count
  from public.orders o
  where o.payment_session_id = p_session_id;

  if v_order_count < 1
     or exists (
       select 1
       from public.orders o
       where o.payment_session_id = p_session_id
         and (
           o.buyer_id <> p_buyer_id
           or o.status <> 'pending'
           or o.payment_status <> 'pending'
         )
     ) then
    raise exception 'checkout_order_state_not_payable' using errcode = '22023';
  end if;

  update public.payment_sessions
  set payment_provider = v_provider,
      provider_payment_id = v_payment_id,
      stripe_payment_intent_id = case
        when v_provider = 'stripe' then v_payment_id
        else stripe_payment_intent_id
      end,
      status = 'requires_payment',
      metadata = metadata || jsonb_build_object(
        'payment_provider', v_provider,
        'payment_initialization_attempt_id', p_attempt_id,
        'payment_initialization_uncertain', false
      ),
      updated_at = now()
  where id = p_session_id;

  update public.orders
  set payment_intent_id = v_payment_id,
      metadata = metadata || jsonb_build_object('payment_provider', v_provider),
      updated_at = now()
  where payment_session_id = p_session_id
    and buyer_id = p_buyer_id
    and status = 'pending'
    and payment_status = 'pending';

  get diagnostics v_updated = row_count;
  if v_updated <> v_order_count then
    raise exception 'checkout_order_payment_reference_integrity_failure' using errcode = '55000';
  end if;
end;
$$;

revoke all on function public.service_attach_checkout_payment_reference(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.service_attach_checkout_payment_reference(uuid, uuid, uuid, text, text)
  to service_role;

-- After an external processor call starts, a timeout or transport failure is
-- ambiguous: the provider may have accepted the request even when our server
-- never received its response. Never release inventory or cancel orders here.
-- Keep the durable claim so automatic retry remains impossible until a trusted
-- reconciliation process proves what happened at the provider.
create or replace function public.service_mark_checkout_payment_initialization_uncertain(
  p_session_id uuid,
  p_buyer_id uuid,
  p_attempt_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_session public.payment_sessions%rowtype;
begin
  if p_session_id is null or p_buyer_id is null or p_attempt_id is null then
    raise exception 'payment_initialization_identifiers_required' using errcode = '22023';
  end if;

  select * into v_session
  from public.payment_sessions
  where id = p_session_id
  for update;

  if not found
     or v_session.buyer_id <> p_buyer_id
     or v_session.payment_initialization_attempt_id is distinct from p_attempt_id
     or v_session.payment_initialization_started_at is null then
    raise exception 'payment_initialization_attempt_not_found_or_access_denied' using errcode = '42501';
  end if;

  if v_session.status not in ('pending', 'requires_payment') then
    return;
  end if;

  -- A provider reference may have committed even if the caller missed the RPC
  -- response. In that case the canonical stored reference is already the
  -- reconciliation anchor; do not overwrite its metadata with uncertainty.
  if v_session.payment_provider is not null
     or v_session.provider_payment_id is not null
     or v_session.stripe_payment_intent_id is not null then
    return;
  end if;

  update public.payment_sessions
  set metadata = metadata || jsonb_build_object(
        'payment_initialization_uncertain', true,
        'payment_initialization_uncertain_at', now(),
        'payment_initialization_attempt_id', p_attempt_id
      ),
      updated_at = now()
  where id = p_session_id;
end;
$$;

revoke all on function public.service_mark_checkout_payment_initialization_uncertain(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.service_mark_checkout_payment_initialization_uncertain(uuid, uuid, uuid)
  to service_role;

-- Buyer cancellation is allowed only before any external payment initialization
-- claim exists. Once claimed, no browser action may release inventory underneath
-- an in-flight or ambiguous processor operation.
create or replace function public.cancel_checkout_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.payment_sessions
  set status = 'cancelled',
      updated_at = now()
  where id = p_session_id
    and buyer_id = auth.uid()
    and status in ('pending', 'requires_payment')
    and payment_initialization_attempt_id is null;

  if not found then
    raise exception 'Checkout session not found or is no longer cancellable'
      using errcode = '42501';
  end if;

  update public.inventory_reservations
  set status = 'released',
      updated_at = now()
  where payment_session_id = p_session_id
    and status = 'pending';

  update public.orders
  set status = 'cancelled',
      payment_status = 'failed',
      updated_at = now()
  where payment_session_id = p_session_id
    and payment_status = 'pending';
end;
$$;

revoke all on function public.cancel_checkout_session(uuid) from public, anon;
grant execute on function public.cancel_checkout_session(uuid) to authenticated, service_role;

comment on column public.payment_sessions.payment_initialization_attempt_id is
  'Server-generated durable claim that serializes external payment initialization. Never automatically cleared or replaced after an ambiguous processor attempt.';
comment on column public.payment_sessions.payment_initialization_started_at is
  'Timestamp when trusted server authority claimed the external payment initialization attempt.';
comment on function public.service_claim_checkout_payment_initialization(uuid, uuid, uuid) is
  'Service-only pre-processor claim. Locks the checkout, validates Buyer/order/reservation state and prevents duplicate external payment initialization.';
comment on function public.service_attach_checkout_payment_reference(uuid, uuid, uuid, text, text) is
  'Service-only provider-reference binding tied to the exact Buyer and initialization attempt.';
comment on function public.service_mark_checkout_payment_initialization_uncertain(uuid, uuid, uuid) is
  'Service-only reconciliation lock marker for ambiguous external initialization. Never cancels orders, releases inventory, clears the attempt, or authorizes retry.';

commit;
