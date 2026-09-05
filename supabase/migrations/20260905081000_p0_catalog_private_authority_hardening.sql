-- EntizNetStore P0 — reduce browser-callable SECURITY DEFINER surface for
-- Seller catalogue mutations.
--
-- Preserve the already-audited function objects and their exact business logic
-- by moving them into non-exposed app_private, then recreate the public Data API
-- signatures as SECURITY INVOKER wrappers. No caller-supplied Seller identity is
-- introduced; the authorities continue deriving the actor via auth.uid().

begin;

-- Move the existing audited authority objects rather than copying/reimplementing
-- their PL/pgSQL bodies. Function OIDs, ownership and body semantics are retained.
alter function public.seller_save_product_v3(uuid,text,text,text,text,numeric,numeric,numeric,uuid,uuid[],text[],jsonb,boolean,boolean,boolean,boolean,integer,text,integer,text[],text[])
  set schema app_private;
alter function app_private.seller_save_product_v3(uuid,text,text,text,text,numeric,numeric,numeric,uuid,uuid[],text[],jsonb,boolean,boolean,boolean,boolean,integer,text,integer,text[],text[])
  rename to seller_save_product_v3_authority;

alter function public.seller_delete_product(uuid) set schema app_private;
alter function app_private.seller_delete_product(uuid) rename to seller_delete_product_authority;

alter function public.seller_set_product_publication(uuid,boolean) set schema app_private;
alter function app_private.seller_set_product_publication(uuid,boolean) rename to seller_set_product_publication_authority;

alter function public.seller_submit_product_for_review(uuid) set schema app_private;
alter function app_private.seller_submit_product_for_review(uuid) rename to seller_submit_product_for_review_authority;

-- Preserve the public RPC contracts as invoker-only delegates.
create function public.seller_save_product_v3(
  p_product_id uuid,
  p_title text,
  p_description text,
  p_short_description text,
  p_product_type text,
  p_base_price numeric,
  p_compare_at_price numeric,
  p_cost_per_item numeric,
  p_brand_id uuid,
  p_category_ids uuid[],
  p_media_urls text[],
  p_variants jsonb,
  p_track_inventory boolean,
  p_continue_selling boolean,
  p_requires_shipping boolean,
  p_is_taxable boolean,
  p_weight_grams integer,
  p_material text,
  p_age_restriction integer,
  p_tags text[],
  p_search_keywords text[]
)
returns uuid
language sql
security invoker
set search_path = 'pg_catalog'
as $$
  select app_private.seller_save_product_v3_authority(
    p_product_id, p_title, p_description, p_short_description, p_product_type,
    p_base_price, p_compare_at_price, p_cost_per_item, p_brand_id,
    p_category_ids, p_media_urls, p_variants, p_track_inventory,
    p_continue_selling, p_requires_shipping, p_is_taxable, p_weight_grams,
    p_material, p_age_restriction, p_tags, p_search_keywords
  );
$$;

create function public.seller_delete_product(p_product_id uuid)
returns void
language sql
security invoker
set search_path = 'pg_catalog'
as $$
  select app_private.seller_delete_product_authority(p_product_id);
$$;

create function public.seller_set_product_publication(p_product_id uuid, p_active boolean)
returns void
language sql
security invoker
set search_path = 'pg_catalog'
as $$
  select app_private.seller_set_product_publication_authority(p_product_id, p_active);
$$;

create function public.seller_submit_product_for_review(p_product_id uuid)
returns void
language sql
security invoker
set search_path = 'pg_catalog'
as $$
  select app_private.seller_submit_product_for_review_authority(p_product_id);
$$;

-- New functions default EXECUTE to PUBLIC in PostgreSQL. Freeze both layers to
-- the pre-existing browser/service roles and keep anonymous execution denied.
grant usage on schema app_private to authenticated, service_role;

revoke all on function app_private.seller_save_product_v3_authority(uuid,text,text,text,text,numeric,numeric,numeric,uuid,uuid[],text[],jsonb,boolean,boolean,boolean,boolean,integer,text,integer,text[],text[]) from public, anon;
revoke all on function app_private.seller_delete_product_authority(uuid) from public, anon;
revoke all on function app_private.seller_set_product_publication_authority(uuid,boolean) from public, anon;
revoke all on function app_private.seller_submit_product_for_review_authority(uuid) from public, anon;

grant execute on function app_private.seller_save_product_v3_authority(uuid,text,text,text,text,numeric,numeric,numeric,uuid,uuid[],text[],jsonb,boolean,boolean,boolean,boolean,integer,text,integer,text[],text[]) to authenticated, service_role;
grant execute on function app_private.seller_delete_product_authority(uuid) to authenticated, service_role;
grant execute on function app_private.seller_set_product_publication_authority(uuid,boolean) to authenticated, service_role;
grant execute on function app_private.seller_submit_product_for_review_authority(uuid) to authenticated, service_role;

revoke all on function public.seller_save_product_v3(uuid,text,text,text,text,numeric,numeric,numeric,uuid,uuid[],text[],jsonb,boolean,boolean,boolean,boolean,integer,text,integer,text[],text[]) from public, anon;
revoke all on function public.seller_delete_product(uuid) from public, anon;
revoke all on function public.seller_set_product_publication(uuid,boolean) from public, anon;
revoke all on function public.seller_submit_product_for_review(uuid) from public, anon;

grant execute on function public.seller_save_product_v3(uuid,text,text,text,text,numeric,numeric,numeric,uuid,uuid[],text[],jsonb,boolean,boolean,boolean,boolean,integer,text,integer,text[],text[]) to authenticated, service_role;
grant execute on function public.seller_delete_product(uuid) to authenticated, service_role;
grant execute on function public.seller_set_product_publication(uuid,boolean) to authenticated, service_role;
grant execute on function public.seller_submit_product_for_review(uuid) to authenticated, service_role;

commit;
