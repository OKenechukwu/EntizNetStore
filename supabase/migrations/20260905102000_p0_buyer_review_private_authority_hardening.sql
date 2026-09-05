begin;

alter function public.buyer_submit_review(uuid, uuid, integer, text, text, boolean)
  set schema app_private;

alter function app_private.buyer_submit_review(uuid, uuid, integer, text, text, boolean)
  rename to buyer_submit_review_authority;

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
