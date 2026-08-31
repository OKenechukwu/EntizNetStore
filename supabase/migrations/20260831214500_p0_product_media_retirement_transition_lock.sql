-- P0 product-media retirement transition hardening.
--
-- The service orphan-claim RPC already acquires the per-object lifecycle lock,
-- but upload_scan_jobs remains service-role writable for the scanner pipeline.
-- Make the retirement transition itself authoritative so any direct trusted
-- server update must serialize with authenticated catalogue attachment and must
-- prove that no catalogue reference exists.

begin;

create or replace function app_private.guard_product_media_retirement_immutable()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_suffix text;
begin
  if old.retired_at is not null
     and new.retired_at is distinct from old.retired_at then
    raise exception 'product_media_retirement_is_immutable' using errcode = '55000';
  end if;

  if old.retired_at is null and new.retired_at is not null then
    if new.purpose is distinct from 'product_media'
       or new.destination_bucket is distinct from 'product-media'
       or new.destination_path is null
       or new.actor_id is null
       or new.destination_path !~ (
         '^' || new.actor_id::text ||
         '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|png|webp)$'
       ) then
      raise exception 'product_media_retirement_context_invalid' using errcode = '22023';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'entiznetstore:product-media:' || new.destination_path,
        0
      )
    );

    v_suffix := '/storage/v1/object/public/product-media/' || new.destination_path;

    if exists (
      select 1
      from public.product_media pm
      where right(
        split_part(split_part(pm.url, '#', 1), '?', 1),
        char_length(v_suffix)
      ) = v_suffix
    ) then
      raise exception 'product_media_retirement_still_referenced' using errcode = '55000';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app_private.guard_product_media_retirement_immutable()
  from public, anon, authenticated;
grant execute on function app_private.guard_product_media_retirement_immutable()
  to service_role;

comment on function app_private.guard_product_media_retirement_immutable() is
  'Makes product-media retirement irreversible and reference-authoritative. Every retirement transition serializes with catalogue attachment on the same object advisory lock and rejects live catalogue references.';

commit;
