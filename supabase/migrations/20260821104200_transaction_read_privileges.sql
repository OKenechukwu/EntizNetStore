-- P0 authorization correction: RLS policies do not grant table privileges.
-- Authenticated participants need SELECT on the transaction tables whose RLS
-- policies already restrict rows to the owning buyer/seller. Writes remain
-- function-only; payment_webhook_events stays service-role/internal only.

grant select on table public.payment_sessions to authenticated;
grant select on table public.inventory_reservations to authenticated;
grant select on table public.orders to authenticated;
grant select on table public.order_items to authenticated;
grant select on table public.escrow_transactions to authenticated;

-- Make the negative side explicit. API roles never directly mutate commerce
-- ledgers/reservations and never inspect raw webhook deduplication records.
revoke insert, update, delete, truncate, references, trigger
  on table public.payment_sessions,
           public.inventory_reservations,
           public.orders,
           public.order_items,
           public.escrow_transactions
  from anon, authenticated;

revoke all on table public.payment_webhook_events from public, anon, authenticated;
