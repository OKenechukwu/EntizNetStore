-- EntizNetStore M2 — database invariant: public/checkout-eligible `active`
-- products must be Admin-approved. This protects SECURITY DEFINER commerce
-- paths and trusted-worker mistakes in addition to RLS/UI lifecycle controls.

begin;

alter table public.products
  drop constraint if exists products_active_requires_moderation_approval;

alter table public.products
  add constraint products_active_requires_moderation_approval
  check (status <> 'active' or moderation_status = 'approved');

commit;
