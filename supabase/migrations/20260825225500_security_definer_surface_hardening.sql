-- EntizNetStore P0 security-definer surface hardening.
--
-- The provider-neutral payment boundary is canonical. The Stripe-specific
-- attach_checkout_payment_intent() compatibility wrapper has no application
-- call sites and no longer needs to be callable by signed-in browser clients.
-- Keep it available only to the trusted service role for controlled legacy
-- compatibility while preserving attach_checkout_payment_reference() as the
-- reviewed, auth.uid()-scoped client payment-reference RPC.

begin;

revoke all on function public.attach_checkout_payment_intent(uuid, text)
  from public, anon, authenticated;

grant execute on function public.attach_checkout_payment_intent(uuid, text)
  to service_role;

commit;
