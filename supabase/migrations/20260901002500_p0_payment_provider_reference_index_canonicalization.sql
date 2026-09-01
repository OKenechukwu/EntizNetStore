-- P0 payment provider-reference index canonicalization.
--
-- 20260822050257 introduced idx_payment_sessions_provider_payment as a unique
-- partial index on (payment_provider, provider_payment_id). The payment
-- initialization authority adds the semantically clearer
-- idx_payment_sessions_provider_reference_unique with the same key/predicate.
-- Retain only the canonical index so payment-session writes do not maintain two
-- identical unique btrees.

begin;

drop index if exists public.idx_payment_sessions_provider_payment;

-- Fail the migration rather than silently losing provider-reference uniqueness
-- if the canonical replacement was not created by the preceding migration.
do $$
begin
  if to_regclass('public.idx_payment_sessions_provider_reference_unique') is null then
    raise exception 'canonical payment provider-reference uniqueness index is missing';
  end if;
end
$$;

commit;
