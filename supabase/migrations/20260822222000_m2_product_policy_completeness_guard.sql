-- EntizNetStore M2 — product review/publication must not rely on fabricated
-- logistics or return terms. A reviewable product needs a real Seller return
-- policy, and shippable products also need a real Seller shipping policy.
-- This trigger reinforces the application/RPC workflow even for trusted direct
-- writes to moderation state.

begin;

create or replace function public.guard_product_moderation_prerequisites()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_seller public.profiles_seller%rowtype;
begin
  if new.moderation_status not in ('pending', 'approved') then
    return new;
  end if;

  -- Avoid repeating the cross-table checks on unrelated product updates when
  -- moderation state remains unchanged.
  if tg_op = 'UPDATE'
     and new.moderation_status is not distinct from old.moderation_status
     and new.seller_id is not distinct from old.seller_id
     and new.requires_shipping is not distinct from old.requires_shipping then
    return new;
  end if;

  select * into v_seller
  from public.profiles_seller
  where id = new.seller_id;

  if not found then
    raise exception 'seller_profile_required' using errcode = '23514';
  end if;
  if v_seller.verification_status <> 'verified' then
    raise exception 'seller_verification_required' using errcode = '23514';
  end if;
  if nullif(btrim(coalesce(v_seller.return_policy, '')), '') is null then
    raise exception 'seller_return_policy_required' using errcode = '23514';
  end if;
  if coalesce(new.requires_shipping, true)
     and nullif(btrim(coalesce(v_seller.shipping_policy, '')), '') is null then
    raise exception 'seller_shipping_policy_required' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.product_categories pc where pc.product_id = new.id
  ) then
    raise exception 'product_category_required' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.product_media pm
    where pm.product_id = new.id and pm.type = 'image'
  ) then
    raise exception 'product_image_required' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.product_variants pv
    where pv.product_id = new.id and pv.is_active and pv.price > 0
  ) then
    raise exception 'active_product_variant_required' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_product_moderation_prerequisites
  on public.products;
create trigger trg_guard_product_moderation_prerequisites
before update of moderation_status, seller_id, requires_shipping
on public.products
for each row
execute function public.guard_product_moderation_prerequisites();

revoke all on function public.guard_product_moderation_prerequisites()
  from public, anon, authenticated;

commit;
