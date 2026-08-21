-- EntizNetStore P0 trusted-worker privilege contract.
--
-- Supabase's service_role bypasses RLS, but PostgreSQL table privileges are a
-- separate gate. Fresh environments must not depend on implicit platform
-- grants: trusted server/admin/webhook code needs an explicit DML contract on
-- the canonical application schema.
--
-- This role is server-only and is never exposed to browser/mobile clients.

grant usage on schema public to service_role;

grant select, insert, update, delete on table
  public.addresses,
  public.admin_audit_logs,
  public.brands,
  public.categories,
  public.content_pages,
  public.conversation_keys,
  public.conversations,
  public.escrow_transactions,
  public.featured_products,
  public.inventory_reservations,
  public.kyc_documents,
  public.kyc_verification_requests,
  public.message_attachments,
  public.messages,
  public.notifications,
  public.order_items,
  public.orders,
  public.payment_sessions,
  public.payment_webhook_events,
  public.product_categories,
  public.product_media,
  public.product_variants,
  public.products,
  public.profiles_buyer,
  public.profiles_seller,
  public.profiles_seller_private,
  public.reviews
  to service_role;

-- Keep future application tables/sequences created by repository migrations
-- consistent with the same trusted-worker contract. This changes privileges
-- for objects subsequently created by the migration owner; it does not grant
-- anything to anon/authenticated clients.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant usage, select, update on sequences to service_role;
