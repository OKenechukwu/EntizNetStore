\set ON_ERROR_STOP on

-- Focused regression for out-of-order callbacks after inventory has already been
-- released. Terminal payment sessions must never be reopened by later events.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '91000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'terminal-buyer@test.invalid', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.profiles_buyer(id, display_name)
values ('91000000-0000-0000-0000-000000000001', 'Terminal Buyer');

insert into public.payment_sessions(
  id, buyer_id, idempotency_key, status, amount_cents,
  payment_provider, provider_payment_id
)
values
  (
    '92000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000003',
    'failed', 1000, 'simulator', 'sim_terminal_failed'
  ),
  (
    '94000000-0000-0000-0000-000000000004',
    '91000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000005',
    'cancelled', 1000, 'simulator', 'sim_terminal_cancelled'
  );

set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- Retryable callback after terminal failure is audited but cannot resurrect it.
select public.finalize_checkout_payment_v2(
  'evt_retry_after_terminal',
  'simulator.payment.retryable_failure',
  '92000000-0000-0000-0000-000000000002',
  'simulator',
  'sim_terminal_failed',
  'retryable_failure'
);

-- A different terminal callback after cancellation also preserves cancellation.
select public.finalize_checkout_payment_v2(
  'evt_failure_after_cancel',
  'simulator.payment.terminal_failure',
  '94000000-0000-0000-0000-000000000004',
  'simulator',
  'sim_terminal_cancelled',
  'terminal_failure'
);

do $$
declare
  v_failed_status text;
  v_cancelled_status text;
  v_events integer;
begin
  select status into v_failed_status
  from public.payment_sessions
  where id = '92000000-0000-0000-0000-000000000002';

  select status into v_cancelled_status
  from public.payment_sessions
  where id = '94000000-0000-0000-0000-000000000004';

  select count(*) into v_events
  from public.payment_webhook_events
  where provider = 'simulator'
    and event_id in (
      'simulator:evt_retry_after_terminal',
      'simulator:evt_failure_after_cancel'
    );

  if v_failed_status <> 'failed'
     or v_cancelled_status <> 'cancelled'
     or v_events <> 2 then
    raise exception 'Terminal-state immutability failed: failed %, cancelled %, events %',
      v_failed_status, v_cancelled_status, v_events;
  end if;
end
$$;

-- A late success after stock could have been released is not silently accepted.
do $$
begin
  begin
    perform public.finalize_checkout_payment_v2(
      'evt_success_after_terminal',
      'simulator.payment.succeeded',
      '92000000-0000-0000-0000-000000000002',
      'simulator',
      'sim_terminal_failed',
      'succeeded'
    );
    raise exception 'Late success against terminal checkout unexpectedly succeeded';
  exception when others then
    if sqlerrm not like 'Checkout session is no longer payable%' then
      raise;
    end if;
  end;
end
$$;

rollback;

\echo 'EntizNetStore terminal payment-state regression suite passed'
