-- M2 follow-up: apply the same moderation prerequisites to trusted product
-- inserts that attempt to start directly in pending/approved state.

begin;

drop trigger if exists trg_guard_product_moderation_prerequisites_insert
  on public.products;
create trigger trg_guard_product_moderation_prerequisites_insert
before insert on public.products
for each row
execute function public.guard_product_moderation_prerequisites();

commit;
