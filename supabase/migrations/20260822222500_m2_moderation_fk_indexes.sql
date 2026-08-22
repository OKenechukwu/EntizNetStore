-- EntizNetStore M2 follow-up: cover moderation reviewer foreign keys reported by
-- the Supabase performance advisor after live M2 structural rollout.

begin;

create index if not exists idx_products_moderated_by
  on public.products(moderated_by);

create index if not exists idx_product_moderation_events_actor_id
  on public.product_moderation_events(actor_id);

commit;
