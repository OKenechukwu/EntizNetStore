-- M2 follow-up: prefer clean storefront slugs while keeping deterministic
-- collision safety. Existing unique storefront names are normalized before
-- public launch; the trigger then preserves the slug across later name edits.

begin;

create or replace function public.ensure_seller_store_slug()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_base text;
  v_candidate text;
begin
  if nullif(btrim(new.store_slug), '') is null then
    v_base := btrim(regexp_replace(lower(btrim(coalesce(new.storefront_name, 'store'))), '[^a-z0-9]+', '-', 'g'), '-');
    if v_base = '' then v_base := 'store'; end if;
    v_candidate := v_base;
    if exists (
      select 1 from public.profiles_seller s
      where s.store_slug = v_candidate and s.id <> new.id
    ) then
      v_candidate := v_base || '-' || substr(replace(new.id::text, '-', ''), 1, 12);
    end if;
    new.store_slug := v_candidate;
  else
    new.store_slug := lower(btrim(new.store_slug));
    if new.store_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
      raise exception 'invalid_store_slug' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

with candidates as (
  select
    id,
    btrim(regexp_replace(lower(btrim(storefront_name)), '[^a-z0-9]+', '-', 'g'), '-') as base_slug
  from public.profiles_seller
), unique_candidates as (
  select base_slug
  from candidates
  where base_slug <> ''
  group by base_slug
  having count(*) = 1
)
update public.profiles_seller s
set store_slug = c.base_slug
from candidates c
join unique_candidates u on u.base_slug = c.base_slug
where s.id = c.id
  and s.store_slug is distinct from c.base_slug;

commit;
