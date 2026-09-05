begin;

alter function public.buyer_submit_review(uuid, uuid, integer, text, text, boolean)
  set schema app_private;

alter function app_private.buyer_submit_review(uuid, uuid, integer, text, text, boolean)
  rename to buyer_submit_review_authority;

-- Canonicalize the preserved authority body while retaining the same signature,
-- OID and behavior. This removes formatting-only drift between hosted production
-- and zero-to-head repository replay so security assertions prove one definition.
create or replace function app_private.buyer_submit_review_authority(
  p_order_id uuid,
  p_product_id uuid,
  p_rating integer,
  p_title text,
  p_content text,
  p_is_anonymous boolean
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_buyer uuid:=auth.uid(); v_review_id uuid;
  v_title text:=nullif(btrim(coalesce(p_title,'')),'');
  v_content text:=nullif(btrim(coalesce(p_content,'')),'');
begin
  if v_buyer is null then raise exception 'authentication_required' using errcode='28000'; end if;
  if not public.marketplace_capability_is_active(v_buyer,'buyer') then raise exception 'active_buyer_capability_required' using errcode='42501'; end if;
  if p_order_id is null or p_product_id is null then raise exception 'review_order_and_product_required' using errcode='22023'; end if;
  if p_rating is null or p_rating<1 or p_rating>5 then raise exception 'invalid_review_rating' using errcode='22023'; end if;
  if v_title is not null and char_length(v_title)>200 then raise exception 'review_title_too_long' using errcode='22023'; end if;
  if v_content is not null and char_length(v_content)>5000 then raise exception 'review_content_too_long' using errcode='22023'; end if;
  if v_title is null and v_content is null then raise exception 'review_text_required' using errcode='22023'; end if;
  if not exists (
    select 1 from public.orders o join public.order_items oi on oi.order_id=o.id
    where o.id=p_order_id and o.buyer_id=v_buyer and o.status='delivered'
      and o.payment_status in ('paid','partially_refunded','refunded') and oi.product_id=p_product_id
  ) then raise exception 'verified_delivered_purchase_required' using errcode='42501'; end if;
  if exists (select 1 from public.reviews r where r.buyer_id=v_buyer and r.order_id=p_order_id and r.product_id=p_product_id) then raise exception 'review_already_submitted_for_order_product' using errcode='23505'; end if;
  insert into public.reviews(product_id,buyer_id,order_id,rating,title,content,is_verified_purchase,is_anonymous,status,created_at,updated_at)
  values (p_product_id,v_buyer,p_order_id,p_rating,v_title,v_content,true,coalesce(p_is_anonymous,false),'pending',now(),now()) returning id into v_review_id;
  return v_review_id;
end;
$$;

create function public.buyer_submit_review(
  p_order_id uuid,
  p_product_id uuid,
  p_rating integer,
  p_title text,
  p_content text,
  p_is_anonymous boolean
)
returns uuid
language sql
security invoker
set search_path = 'pg_catalog'
as $$
  select app_private.buyer_submit_review_authority(
    p_order_id,
    p_product_id,
    p_rating,
    p_title,
    p_content,
    p_is_anonymous
  );
$$;

grant usage on schema app_private to authenticated, service_role;

revoke all on function app_private.buyer_submit_review_authority(uuid, uuid, integer, text, text, boolean)
  from public, anon;
grant execute on function app_private.buyer_submit_review_authority(uuid, uuid, integer, text, text, boolean)
  to authenticated, service_role;

revoke all on function public.buyer_submit_review(uuid, uuid, integer, text, text, boolean)
  from public, anon;
grant execute on function public.buyer_submit_review(uuid, uuid, integer, text, text, boolean)
  to authenticated, service_role;

commit;
