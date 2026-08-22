-- EntizNetStore M2 — inventory edits must respect active checkout reservations.
-- A Seller may increase stock freely, but a tracked/deny-policy variant cannot
-- be reduced below quantities already reserved by non-expired pending checkout
-- sessions. Trusted payment finalization runs without an auth.uid() and is not
-- blocked by this Seller-edit guard when it consumes those reservations.

begin;

create or replace function public.guard_seller_inventory_against_reservations()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_reserved integer := 0;
begin
  -- Only police authenticated end-user catalogue mutations. Trusted workers
  -- and payment finalization use their own transaction/state-machine guards.
  if v_actor is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.inventory_quantity is not distinct from old.inventory_quantity
     and new.track_inventory is not distinct from old.track_inventory
     and new.inventory_policy is not distinct from old.inventory_policy then
    return new;
  end if;

  if coalesce(new.track_inventory, true)
     and coalesce(new.inventory_policy, 'deny') = 'deny' then
    select coalesce(sum(r.quantity), 0)::integer
      into v_reserved
    from public.inventory_reservations r
    where r.variant_id = new.id
      and r.status = 'pending'
      and r.expires_at > now();

    if coalesce(new.inventory_quantity, 0) < v_reserved then
      raise exception 'inventory_below_pending_reservations:%', v_reserved
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_seller_inventory_reservations
  on public.product_variants;
create trigger trg_guard_seller_inventory_reservations
before insert or update of inventory_quantity, track_inventory, inventory_policy
on public.product_variants
for each row
execute function public.guard_seller_inventory_against_reservations();

revoke all on function public.guard_seller_inventory_against_reservations()
  from public, anon, authenticated;

commit;
