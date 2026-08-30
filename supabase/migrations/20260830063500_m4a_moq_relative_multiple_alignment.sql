-- EntizNetStore M4A follow-up: align offer persistence with canonical cart
-- quantity semantics. An order multiple is an increment from the MOQ, not a
-- divisor of the MOQ. Example: MOQ 12, multiple 5 => 12, 17, 22, 27, ...
--
-- This is intentionally a forward migration rather than rewriting the M4A
-- foundation migration. The cart/quote/checkout authority already validates
-- quantities as (quantity - MOQ) % multiple = 0.

begin;

alter table public.wholesale_offers
  drop constraint if exists wholesale_offers_moq_multiple_check;

create or replace function public.business_save_wholesale_offer(
  p_offer_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_status text,
  p_minimum_order_quantity integer,
  p_order_multiple integer,
  p_unit_label text,
  p_case_pack_size integer,
  p_lead_time_days integer,
  p_incoterm text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_tiers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_offer_id uuid;
  v_status text := lower(btrim(coalesce(p_status, 'draft')));
  v_unit_label text := btrim(coalesce(p_unit_label, ''));
  v_incoterm text := nullif(upper(btrim(coalesce(p_incoterm, ''))), '');
  v_tier jsonb;
  v_minimum integer;
  v_price bigint;
  v_previous_minimum integer := 0;
  v_previous_price bigint := null;
  v_ordinality bigint;
  v_product record;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles_business where id = v_user_id) then
    raise exception 'business_profile_required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles_seller where id = v_user_id) then
    raise exception 'seller_profile_required' using errcode = '42501';
  end if;
  if not app_private.marketplace_capability_is_active(v_user_id, 'business')
     or not app_private.marketplace_capability_is_active(v_user_id, 'seller') then
    raise exception 'business_or_seller_capability_suspended' using errcode = '42501';
  end if;

  if v_status not in ('draft', 'active', 'paused', 'archived')
     or p_minimum_order_quantity is null
     or p_minimum_order_quantity < 1
     or p_minimum_order_quantity > 100000
     or p_order_multiple is null
     or p_order_multiple < 1
     or p_order_multiple > 100000
     or char_length(v_unit_label) < 1
     or char_length(v_unit_label) > 40
     or (p_case_pack_size is not null and (p_case_pack_size < 1 or p_case_pack_size > 100000))
     or p_lead_time_days is null
     or p_lead_time_days < 0
     or p_lead_time_days > 365
     or (v_incoterm is not null and v_incoterm not in ('EXW','FCA','CPT','CIP','DAP','DPU','DDP','FAS','FOB','CFR','CIF'))
     or (p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at) then
    raise exception 'invalid_wholesale_offer' using errcode = '22023';
  end if;

  if p_tiers is null
     or jsonb_typeof(p_tiers) <> 'array'
     or jsonb_array_length(p_tiers) < 1
     or jsonb_array_length(p_tiers) > 20 then
    raise exception 'invalid_wholesale_pricing_tiers' using errcode = '22023';
  end if;

  select p.id, p.seller_id, p.status, p.moderation_status,
         pv.id as variant_id, pv.is_active
    into v_product
  from public.products p
  join public.product_variants pv on pv.product_id = p.id
  where p.id = p_product_id
    and pv.id = p_variant_id
    and p.seller_id = v_user_id;

  if v_product.id is null then
    raise exception 'wholesale_offer_catalogue_not_owned' using errcode = '42501';
  end if;

  if p_offer_id is null then
    insert into public.wholesale_offers(
      seller_id, product_id, variant_id, status, minimum_order_quantity,
      order_multiple, unit_label, case_pack_size, lead_time_days, incoterm,
      starts_at, ends_at
    ) values (
      v_user_id, p_product_id, p_variant_id, 'draft', p_minimum_order_quantity,
      p_order_multiple, v_unit_label, p_case_pack_size, p_lead_time_days,
      v_incoterm, p_starts_at, p_ends_at
    ) returning id into v_offer_id;
  else
    update public.wholesale_offers
    set product_id = p_product_id,
        variant_id = p_variant_id,
        status = 'draft',
        minimum_order_quantity = p_minimum_order_quantity,
        order_multiple = p_order_multiple,
        unit_label = v_unit_label,
        case_pack_size = p_case_pack_size,
        lead_time_days = p_lead_time_days,
        incoterm = v_incoterm,
        starts_at = p_starts_at,
        ends_at = p_ends_at,
        updated_at = now()
    where id = p_offer_id
      and seller_id = v_user_id
    returning id into v_offer_id;

    if v_offer_id is null then
      raise exception 'wholesale_offer_not_found_or_access_denied' using errcode = '42501';
    end if;
  end if;

  delete from public.wholesale_offer_tiers where offer_id = v_offer_id;

  for v_tier, v_ordinality in
    select value, ordinality
    from jsonb_array_elements(p_tiers) with ordinality
  loop
    begin
      v_minimum := (v_tier->>'minimumQuantity')::integer;
      v_price := (v_tier->>'unitPriceCents')::bigint;
    exception when others then
      raise exception 'invalid_wholesale_pricing_tier' using errcode = '22023';
    end;

    if v_minimum < p_minimum_order_quantity
       or v_minimum > 100000
       or ((v_minimum - p_minimum_order_quantity) % p_order_multiple) <> 0
       or v_price < 1
       or v_price > 100000000000
       or v_minimum <= v_previous_minimum
       or (v_previous_price is not null and v_price > v_previous_price) then
      raise exception 'invalid_wholesale_pricing_tier' using errcode = '22023';
    end if;

    if v_ordinality = 1 and v_minimum <> p_minimum_order_quantity then
      raise exception 'first_wholesale_tier_must_equal_moq' using errcode = '22023';
    end if;

    insert into public.wholesale_offer_tiers(offer_id, minimum_quantity, unit_price_cents)
    values (v_offer_id, v_minimum, v_price);

    v_previous_minimum := v_minimum;
    v_previous_price := v_price;
  end loop;

  if v_status = 'active' then
    if v_product.status <> 'active'
       or v_product.moderation_status <> 'approved'
       or not v_product.is_active
       or not exists (
         select 1 from public.profiles_business b
         join public.profiles_seller s on s.id = b.id
         where b.id = v_user_id
           and b.verification_status = 'verified'
           and s.verification_status = 'verified'
       ) then
      raise exception 'wholesale_offer_activation_requires_verified_active_catalogue' using errcode = '22023';
    end if;
  end if;

  update public.wholesale_offers
  set status = v_status,
      updated_at = now()
  where id = v_offer_id;

  return v_offer_id;
end;
$$;

revoke all on function public.business_save_wholesale_offer(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamptz,timestamptz,jsonb)
  from public, anon;
grant execute on function public.business_save_wholesale_offer(uuid,uuid,uuid,text,integer,integer,text,integer,integer,text,timestamptz,timestamptz,jsonb)
  to authenticated, service_role;

commit;