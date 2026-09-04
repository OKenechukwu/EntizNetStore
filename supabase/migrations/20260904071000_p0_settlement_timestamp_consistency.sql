-- EntizNetStore P0 — deterministic settlement hold-clock semantics.
--
-- Use PostgreSQL transaction time for trusted confirmation timestamps. This is
-- stable throughout the transaction that creates the confirmation and therefore
-- composes correctly with payout cutoffs using now()/transaction_timestamp(),
-- including atomic test/admin batches. Callers still cannot supply/backdate it.

begin;

create or replace function private.stamp_order_settlement_confirmation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.confirmed_at := transaction_timestamp();
  new.created_at := new.confirmed_at;
  return new;
end;
$$;

revoke execute on function private.stamp_order_settlement_confirmation()
  from public, anon, authenticated, service_role;

comment on function private.stamp_order_settlement_confirmation() is
  'Owner-only trigger helper. Trusted settlement time is the transaction start and cannot be caller supplied or backdated.';

commit;
