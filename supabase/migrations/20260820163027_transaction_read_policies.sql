-- Participants can read their own transaction records. All writes remain
-- restricted to the checkout/payment functions and trusted webhook worker.
create policy payment_sessions_buyer_select on public.payment_sessions
  for select to authenticated using (buyer_id=auth.uid());

create policy inventory_reservations_buyer_select on public.inventory_reservations
  for select to authenticated using (exists(
    select 1 from public.payment_sessions ps
    where ps.id=inventory_reservations.payment_session_id and ps.buyer_id=auth.uid()
  ));

create policy orders_participant_select on public.orders
  for select to authenticated using (buyer_id=auth.uid() or seller_id=auth.uid());

create policy order_items_participant_select on public.order_items
  for select to authenticated using (exists(
    select 1 from public.orders o
    where o.id=order_items.order_id and (o.buyer_id=auth.uid() or o.seller_id=auth.uid())
  ));

create policy escrow_participant_select on public.escrow_transactions
  for select to authenticated using (
    seller_id=auth.uid() or exists(
      select 1 from public.orders o
      where o.id=escrow_transactions.order_id and o.buyer_id=auth.uid()
    )
  );
