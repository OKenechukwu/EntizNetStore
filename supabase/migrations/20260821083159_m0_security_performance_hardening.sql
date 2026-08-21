-- EntizNetStore M0 production-foundation hardening.
-- Forward-only: preserves the semantics of the already-applied marketplace
-- policies while reducing policy overhead, removes overlapping permissive
-- SELECT policies, hardens SECURITY DEFINER resolution, and adds supporting
-- indexes identified by the live Supabase performance advisor.

-- ---------------------------------------------------------------------------
-- Schema privileges
-- ---------------------------------------------------------------------------
-- API users never need DDL rights in the exposed public schema. The schema
-- owner/migration role retains its owner privileges.
revoke create on schema public from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER hardening
-- ---------------------------------------------------------------------------
-- These functions intentionally remain SECURITY DEFINER because checkout and
-- fulfillment are database-atomic operations that must cross RLS boundaries.
-- They already authenticate/authorize the caller internally. pg_catalog first
-- prevents user-controlled public objects from shadowing built-ins while
-- public remains available for the existing unqualified application tables.
alter function public.create_checkout_session(jsonb, jsonb, uuid)
  set search_path = pg_catalog, public;
alter function public.attach_checkout_payment_intent(uuid, text)
  set search_path = pg_catalog, public;
alter function public.cancel_checkout_session(uuid)
  set search_path = pg_catalog, public;
alter function public.finalize_checkout_payment(text, text, uuid, text, boolean)
  set search_path = pg_catalog, public;
alter function public.transition_seller_order(uuid, text, text, text)
  set search_path = pg_catalog, public;

-- Explicit RPC allowlist. Never rely on PostgreSQL's default PUBLIC EXECUTE.
revoke all on function public.create_checkout_session(jsonb, jsonb, uuid) from public;
revoke all on function public.attach_checkout_payment_intent(uuid, text) from public;
revoke all on function public.cancel_checkout_session(uuid) from public;
revoke all on function public.finalize_checkout_payment(text, text, uuid, text, boolean) from public;
revoke all on function public.mark_conversation_read(uuid) from public;
revoke all on function public.transition_seller_order(uuid, text, text, text) from public;
revoke all on function public.touch_conversation_after_message() from public;

revoke execute on function public.create_checkout_session(jsonb, jsonb, uuid) from anon;
revoke execute on function public.attach_checkout_payment_intent(uuid, text) from anon;
revoke execute on function public.cancel_checkout_session(uuid) from anon;
revoke execute on function public.finalize_checkout_payment(text, text, uuid, text, boolean) from anon, authenticated;
revoke execute on function public.mark_conversation_read(uuid) from anon;
revoke execute on function public.transition_seller_order(uuid, text, text, text) from anon;
revoke execute on function public.touch_conversation_after_message() from anon, authenticated;

grant execute on function public.create_checkout_session(jsonb, jsonb, uuid) to authenticated, service_role;
grant execute on function public.attach_checkout_payment_intent(uuid, text) to authenticated, service_role;
grant execute on function public.cancel_checkout_session(uuid) to authenticated, service_role;
grant execute on function public.finalize_checkout_payment(text, text, uuid, text, boolean) to service_role;
grant execute on function public.mark_conversation_read(uuid) to authenticated, service_role;
grant execute on function public.transition_seller_order(uuid, text, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Foreign-key/supporting indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_addresses_user_id
  on public.addresses (user_id);
create index if not exists idx_categories_parent_id
  on public.categories (parent_id);
create index if not exists idx_featured_products_product_id
  on public.featured_products (product_id);
create index if not exists idx_inventory_reservations_payment_session_id
  on public.inventory_reservations (payment_session_id);
create index if not exists idx_inventory_reservations_product_id
  on public.inventory_reservations (product_id);
create index if not exists idx_messages_order_id
  on public.messages (order_id);
create index if not exists idx_order_items_variant_id
  on public.order_items (variant_id);
create index if not exists idx_payment_webhook_events_payment_session_id
  on public.payment_webhook_events (payment_session_id);
create index if not exists idx_product_categories_category_id
  on public.product_categories (category_id);
create index if not exists idx_product_media_product_id
  on public.product_media (product_id);
create index if not exists idx_product_media_variant_id
  on public.product_media (variant_id);
create index if not exists idx_product_variants_product_id
  on public.product_variants (product_id);
create index if not exists idx_products_brand_id
  on public.products (brand_id);
create index if not exists idx_reviews_buyer_id
  on public.reviews (buyer_id);

-- ---------------------------------------------------------------------------
-- Core profile/product RLS
-- ---------------------------------------------------------------------------
-- Wrap auth.uid() in SELECT so PostgreSQL evaluates it once per statement.

drop policy if exists profiles_buyer_select_own on public.profiles_buyer;
create policy profiles_buyer_select_own on public.profiles_buyer
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_seller_private_select_own on public.profiles_seller_private;
create policy profiles_seller_private_select_own on public.profiles_seller_private
  for select to authenticated
  using (seller_id = (select auth.uid()));

-- Avoid overlapping permissive SELECT policies: anonymous users see verified
-- storefronts; authenticated users see verified storefronts plus their own.
drop policy if exists profiles_seller_public_select_verified on public.profiles_seller;
drop policy if exists profiles_seller_select_own on public.profiles_seller;
create policy profiles_seller_anon_select_verified on public.profiles_seller
  for select to anon
  using (verification_status = 'verified');
create policy profiles_seller_authenticated_select on public.profiles_seller
  for select to authenticated
  using (
    verification_status = 'verified'
    or id = (select auth.uid())
  );

-- Products: same public visibility as before, with one authenticated SELECT
-- policy that also admits the seller's own drafts.
drop policy if exists products_public_select on public.products;
drop policy if exists products_seller_select_own on public.products;
create policy products_anon_select on public.products
  for select to anon
  using (
    status = 'active'
    and seller_id is not null
    and exists (
      select 1 from public.profiles_seller s
      where s.id = products.seller_id
        and s.verification_status = 'verified'
    )
  );
create policy products_authenticated_select on public.products
  for select to authenticated
  using (
    seller_id = (select auth.uid())
    or (
      status = 'active'
      and seller_id is not null
      and exists (
        select 1 from public.profiles_seller s
        where s.id = products.seller_id
          and s.verification_status = 'verified'
      )
    )
  );

drop policy if exists products_seller_insert_own on public.products;
create policy products_seller_insert_own on public.products
  for insert to authenticated
  with check (
    seller_id = (select auth.uid())
    and exists (
      select 1 from public.profiles_seller s
      where s.id = (select auth.uid())
        and (
          (s.verification_status = 'pending' and products.status = 'draft')
          or (s.verification_status = 'verified' and products.status in ('draft', 'active'))
        )
    )
  );

drop policy if exists products_seller_update_own on public.products;
create policy products_seller_update_own on public.products
  for update to authenticated
  using (
    seller_id = (select auth.uid())
    and exists (
      select 1 from public.profiles_seller s
      where s.id = (select auth.uid())
        and (
          (s.verification_status = 'pending' and products.status = 'draft')
          or (s.verification_status = 'verified' and products.status in ('draft', 'active'))
        )
    )
  )
  with check (
    seller_id = (select auth.uid())
    and exists (
      select 1 from public.profiles_seller s
      where s.id = (select auth.uid())
        and (
          (s.verification_status = 'pending' and products.status = 'draft')
          or (s.verification_status = 'verified' and products.status in ('draft', 'active'))
        )
    )
  );

drop policy if exists products_seller_delete_own on public.products;
create policy products_seller_delete_own on public.products
  for delete to authenticated
  using (seller_id = (select auth.uid()));

-- Product child tables previously used an authenticated ALL policy plus an
-- authenticated public SELECT policy, which created overlapping permissive
-- policies. Split writes by command and combine public+owner reads.

drop policy if exists product_variants_public_select on public.product_variants;
drop policy if exists product_variants_seller_all on public.product_variants;
create policy product_variants_anon_select on public.product_variants
  for select to anon
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and p.status = 'active'
        and p.seller_id is not null
        and exists (
          select 1 from public.profiles_seller s
          where s.id = p.seller_id and s.verification_status = 'verified'
        )
    )
  );
create policy product_variants_authenticated_select on public.product_variants
  for select to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and (
          p.seller_id = (select auth.uid())
          or (
            p.status = 'active'
            and p.seller_id is not null
            and exists (
              select 1 from public.profiles_seller s
              where s.id = p.seller_id and s.verification_status = 'verified'
            )
          )
        )
    )
  );
create policy product_variants_seller_insert on public.product_variants
  for insert to authenticated
  with check (exists (
    select 1 from public.products p
    where p.id = product_variants.product_id
      and p.seller_id = (select auth.uid())
  ));
create policy product_variants_seller_update on public.product_variants
  for update to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_variants.product_id
      and p.seller_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.products p
    where p.id = product_variants.product_id
      and p.seller_id = (select auth.uid())
  ));
create policy product_variants_seller_delete on public.product_variants
  for delete to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_variants.product_id
      and p.seller_id = (select auth.uid())
  ));

drop policy if exists product_media_public_select on public.product_media;
drop policy if exists product_media_seller_all on public.product_media;
create policy product_media_anon_select on public.product_media
  for select to anon
  using (
    exists (
      select 1 from public.products p
      where p.id = product_media.product_id
        and p.status = 'active'
        and p.seller_id is not null
        and exists (
          select 1 from public.profiles_seller s
          where s.id = p.seller_id and s.verification_status = 'verified'
        )
    )
  );
create policy product_media_authenticated_select on public.product_media
  for select to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_media.product_id
        and (
          p.seller_id = (select auth.uid())
          or (
            p.status = 'active'
            and p.seller_id is not null
            and exists (
              select 1 from public.profiles_seller s
              where s.id = p.seller_id and s.verification_status = 'verified'
            )
          )
        )
    )
  );
create policy product_media_seller_insert on public.product_media
  for insert to authenticated
  with check (exists (
    select 1 from public.products p
    where p.id = product_media.product_id
      and p.seller_id = (select auth.uid())
  ));
create policy product_media_seller_update on public.product_media
  for update to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_media.product_id
      and p.seller_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.products p
    where p.id = product_media.product_id
      and p.seller_id = (select auth.uid())
  ));
create policy product_media_seller_delete on public.product_media
  for delete to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_media.product_id
      and p.seller_id = (select auth.uid())
  ));

drop policy if exists product_categories_public_select on public.product_categories;
drop policy if exists product_categories_seller_all on public.product_categories;
create policy product_categories_anon_select on public.product_categories
  for select to anon
  using (
    exists (
      select 1 from public.products p
      where p.id = product_categories.product_id
        and p.status = 'active'
        and p.seller_id is not null
        and exists (
          select 1 from public.profiles_seller s
          where s.id = p.seller_id and s.verification_status = 'verified'
        )
    )
  );
create policy product_categories_authenticated_select on public.product_categories
  for select to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_categories.product_id
        and (
          p.seller_id = (select auth.uid())
          or (
            p.status = 'active'
            and p.seller_id is not null
            and exists (
              select 1 from public.profiles_seller s
              where s.id = p.seller_id and s.verification_status = 'verified'
            )
          )
        )
    )
  );
create policy product_categories_seller_insert on public.product_categories
  for insert to authenticated
  with check (exists (
    select 1 from public.products p
    where p.id = product_categories.product_id
      and p.seller_id = (select auth.uid())
  ));
create policy product_categories_seller_update on public.product_categories
  for update to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_categories.product_id
      and p.seller_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.products p
    where p.id = product_categories.product_id
      and p.seller_id = (select auth.uid())
  ));
create policy product_categories_seller_delete on public.product_categories
  for delete to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_categories.product_id
      and p.seller_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- Messaging / transaction RLS init-plan optimization
-- ---------------------------------------------------------------------------
drop policy if exists conversations_participant_select on public.conversations;
create policy conversations_participant_select on public.conversations
  for select to authenticated
  using ((select auth.uid()) = any (participants));

drop policy if exists conversations_participant_insert on public.conversations;
create policy conversations_participant_insert on public.conversations
  for insert to authenticated
  with check (
    (select auth.uid()) = any (participants)
    and cardinality(participants) = 2
    and participants[1] <> participants[2]
  );

drop policy if exists messages_participant_select on public.messages;
create policy messages_participant_select on public.messages
  for select to authenticated
  using (
    sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
  );

drop policy if exists messages_participant_insert on public.messages;
create policy messages_participant_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and recipient_id <> (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (select auth.uid()) = any (c.participants)
        and messages.recipient_id = any (c.participants)
    )
  );

drop policy if exists payment_sessions_buyer_select on public.payment_sessions;
create policy payment_sessions_buyer_select on public.payment_sessions
  for select to authenticated
  using (buyer_id = (select auth.uid()));

drop policy if exists inventory_reservations_buyer_select on public.inventory_reservations;
create policy inventory_reservations_buyer_select on public.inventory_reservations
  for select to authenticated
  using (exists (
    select 1 from public.payment_sessions ps
    where ps.id = inventory_reservations.payment_session_id
      and ps.buyer_id = (select auth.uid())
  ));

drop policy if exists orders_participant_select on public.orders;
create policy orders_participant_select on public.orders
  for select to authenticated
  using (
    buyer_id = (select auth.uid())
    or seller_id = (select auth.uid())
  );

drop policy if exists order_items_participant_select on public.order_items;
create policy order_items_participant_select on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (
        o.buyer_id = (select auth.uid())
        or o.seller_id = (select auth.uid())
      )
  ));

drop policy if exists escrow_participant_select on public.escrow_transactions;
create policy escrow_participant_select on public.escrow_transactions
  for select to authenticated
  using (
    seller_id = (select auth.uid())
    or exists (
      select 1 from public.orders o
      where o.id = escrow_transactions.order_id
        and o.buyer_id = (select auth.uid())
    )
  );
