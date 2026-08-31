-- EntizNetStore M4A hosted foreign-key index hardening.
--
-- Supabase's hosted performance advisor identified two M4A foreign-key paths
-- without covering indexes. Add explicit indexes so product deletion/update
-- checks and durable order-item wholesale-offer references do not degrade as
-- marketplace volume grows.

begin;

create index if not exists idx_wholesale_offers_product_id
  on public.wholesale_offers(product_id);

create index if not exists idx_order_items_wholesale_offer_id
  on public.order_items(wholesale_offer_id);

commit;
