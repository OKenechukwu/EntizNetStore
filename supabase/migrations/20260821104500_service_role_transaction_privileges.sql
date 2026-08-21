-- P0 trusted-worker privilege contract.
--
-- Transaction tables were added after the original baseline and must not rely
-- on environment-specific default grants. `service_role` is the trusted
-- server/worker identity used by verified webhook/admin code and needs an
-- explicit database privilege contract. Browser API roles remain RLS-scoped
-- read-only (authenticated) or denied (anon).

grant select, insert, update, delete
  on table public.payment_sessions,
           public.inventory_reservations,
           public.orders,
           public.order_items,
           public.escrow_transactions,
           public.payment_webhook_events
  to service_role;

-- API clients never mutate these ledgers directly.
revoke insert, update, delete, truncate, references, trigger
  on table public.payment_sessions,
           public.inventory_reservations,
           public.orders,
           public.order_items,
           public.escrow_transactions,
           public.payment_webhook_events
  from anon, authenticated;

-- Raw Stripe webhook deduplication records are trusted-worker-only.
revoke select on table public.payment_webhook_events from anon, authenticated;
