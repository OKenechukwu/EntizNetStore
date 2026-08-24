-- EntizNetStore M3 — post-rollout advisor hardening.
--
-- 1. Cover every new M3 foreign key reported by Supabase's performance advisor.
-- 2. Keep capability-aware public catalogue RLS without exposing the generic
--    SECURITY DEFINER capability probe as a public browser-callable RPC.

begin;

-- ---------------------------------------------------------------------------
-- Foreign-key coverage
-- ---------------------------------------------------------------------------
create index if not exists idx_cart_items_product_id
  on public.cart_items(product_id);
create index if not exists idx_marketplace_capability_state_events_actor_id
  on public.marketplace_capability_state_events(actor_id);
create index if not exists idx_marketplace_capability_states_restored_by
  on public.marketplace_capability_states(restored_by);
create index if not exists idx_marketplace_capability_states_suspended_by
  on public.marketplace_capability_states(suspended_by);
create index if not exists idx_order_dispute_events_actor_id
  on public.order_dispute_events(actor_id);
create index if not exists idx_order_disputes_assigned_admin_id
  on public.order_disputes(assigned_admin_id);
create index if not exists idx_prohibited_product_rules_created_by
  on public.prohibited_product_rules(created_by);
create index if not exists idx_prohibited_product_rules_updated_by
  on public.prohibited_product_rules(updated_by);
create index if not exists idx_refund_requests_dispute_id
  on public.refund_requests(dispute_id);
create index if not exists idx_refund_requests_requested_by
  on public.refund_requests(requested_by);
create index if not exists idx_refund_requests_reviewed_by
  on public.refund_requests(reviewed_by);

-- ---------------------------------------------------------------------------
-- Non-exposed capability helper for RLS
-- ---------------------------------------------------------------------------
create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to anon, authenticated, service_role;

create or replace function app_private.marketplace_capability_is_active(
  p_user_id uuid,
  p_capability text
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_link public.entiznet_identity_links%rowtype;
  v_required_slug text;
begin
  if p_user_id is null or p_capability not in ('buyer', 'seller', 'business') then
    return false;
  end if;

  if p_capability = 'buyer'
     and not exists (select 1 from public.profiles_buyer where id = p_user_id) then
    return false;
  end if;
  if p_capability = 'seller'
     and not exists (select 1 from public.profiles_seller where id = p_user_id) then
    return false;
  end if;
  if p_capability = 'business'
     and not exists (select 1 from public.profiles_business where id = p_user_id) then
    return false;
  end if;

  select * into v_link
  from public.entiznet_identity_links
  where store_user_id = p_user_id
  limit 1;

  if found then
    if v_link.status <> 'active' then
      return false;
    end if;

    v_required_slug := case p_capability
      when 'buyer' then 'entiznetstore_buyer'
      when 'seller' then 'entiznetstore_seller'
      when 'business' then 'entiznetstore_business'
    end;

    if not (
      v_required_slug = any(v_link.capabilities_snapshot)
      or (
        p_capability in ('buyer', 'seller')
        and 'entiznetstore_business' = any(v_link.capabilities_snapshot)
      )
    ) then
      return false;
    end if;
  end if;

  return not exists (
    select 1
    from public.marketplace_capability_states s
    where s.user_id = p_user_id
      and s.capability = p_capability
      and s.status = 'suspended'
  );
end;
$$;

revoke all on function app_private.marketplace_capability_is_active(uuid,text) from public;
grant execute on function app_private.marketplace_capability_is_active(uuid,text)
  to anon, authenticated, service_role;

-- Keep the public helper available to trusted server code and SECURITY DEFINER
-- routines owned by the database role, but remove it from the exposed browser
-- RPC surface.
revoke execute on function public.marketplace_capability_is_active(uuid,text)
  from anon, authenticated;
grant execute on function public.marketplace_capability_is_active(uuid,text)
  to service_role;

-- Public and signed-in catalogue policies use the non-exposed helper.
drop policy if exists products_anon_select on public.products;
create policy products_anon_select on public.products
for select to anon
using (
  status = 'active'
  and moderation_status = 'approved'
  and app_private.marketplace_capability_is_active(seller_id, 'seller')
  and exists (
    select 1 from public.profiles_seller s
    where s.id = products.seller_id
      and s.verification_status = 'verified'
  )
);

drop policy if exists products_authenticated_select on public.products;
create policy products_authenticated_select on public.products
for select to authenticated
using (
  seller_id = (select auth.uid())
  or (
    status = 'active'
    and moderation_status = 'approved'
    and app_private.marketplace_capability_is_active(seller_id, 'seller')
    and exists (
      select 1 from public.profiles_seller s
      where s.id = products.seller_id
        and s.verification_status = 'verified'
    )
  )
);

drop policy if exists product_variants_anon_select on public.product_variants;
create policy product_variants_anon_select on public.product_variants
for select to anon
using (exists (
  select 1 from public.products p
  join public.profiles_seller s on s.id = p.seller_id
  where p.id = product_variants.product_id
    and p.status = 'active'
    and p.moderation_status = 'approved'
    and s.verification_status = 'verified'
    and app_private.marketplace_capability_is_active(p.seller_id, 'seller')
));

drop policy if exists product_variants_authenticated_select on public.product_variants;
create policy product_variants_authenticated_select on public.product_variants
for select to authenticated
using (exists (
  select 1 from public.products p
  where p.id = product_variants.product_id
    and (
      p.seller_id = (select auth.uid())
      or (
        p.status = 'active'
        and p.moderation_status = 'approved'
        and app_private.marketplace_capability_is_active(p.seller_id, 'seller')
        and exists (
          select 1 from public.profiles_seller s
          where s.id = p.seller_id and s.verification_status = 'verified'
        )
      )
    )
));

drop policy if exists product_media_anon_select on public.product_media;
create policy product_media_anon_select on public.product_media
for select to anon
using (exists (
  select 1 from public.products p
  join public.profiles_seller s on s.id = p.seller_id
  where p.id = product_media.product_id
    and p.status = 'active'
    and p.moderation_status = 'approved'
    and s.verification_status = 'verified'
    and app_private.marketplace_capability_is_active(p.seller_id, 'seller')
));

drop policy if exists product_media_authenticated_select on public.product_media;
create policy product_media_authenticated_select on public.product_media
for select to authenticated
using (exists (
  select 1 from public.products p
  where p.id = product_media.product_id
    and (
      p.seller_id = (select auth.uid())
      or (
        p.status = 'active'
        and p.moderation_status = 'approved'
        and app_private.marketplace_capability_is_active(p.seller_id, 'seller')
        and exists (
          select 1 from public.profiles_seller s
          where s.id = p.seller_id and s.verification_status = 'verified'
        )
      )
    )
));

drop policy if exists product_categories_anon_select on public.product_categories;
create policy product_categories_anon_select on public.product_categories
for select to anon
using (exists (
  select 1 from public.products p
  join public.profiles_seller s on s.id = p.seller_id
  where p.id = product_categories.product_id
    and p.status = 'active'
    and p.moderation_status = 'approved'
    and s.verification_status = 'verified'
    and app_private.marketplace_capability_is_active(p.seller_id, 'seller')
));

drop policy if exists product_categories_authenticated_select on public.product_categories;
create policy product_categories_authenticated_select on public.product_categories
for select to authenticated
using (exists (
  select 1 from public.products p
  where p.id = product_categories.product_id
    and (
      p.seller_id = (select auth.uid())
      or (
        p.status = 'active'
        and p.moderation_status = 'approved'
        and app_private.marketplace_capability_is_active(p.seller_id, 'seller')
        and exists (
          select 1 from public.profiles_seller s
          where s.id = p.seller_id and s.verification_status = 'verified'
        )
      )
    )
));

commit;
