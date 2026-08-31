-- P0 product-media retirement transition hardening.
--
-- The service orphan-claim RPC already acquires the per-object lifecycle lock,
-- but upload_scan_jobs remains service-role writable for the scanner pipeline.
-- Make the retirement transition itself authoritative so any direct trusted
-- server update must serialize with authenticated catalogue attachment too.

begin;

create or replace function app_private.guard_product_media_retirement_immutable()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if old.retired_at is not null
     and new.retired_at is distinct from old.retired_at then
    raise exception 'product_media_retirement_is_immutable' using errcode = '55000';
  end if;

  if old.retired_at is null and new.retired_at is not null then
    if new.purpose is distinct from 'product_media'
       or new.destination_bucket is distinct from 'product-media'
       or new.destination_path is null then
      raise exception 'product_media_retirement_context_invalid' using errcode = '22023';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'entiznetstore:product-media:' || new.destination_path,
        0
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function app_private.guard_product_media_retirement_immutable()
  from public, anon, authenticated;
grant execute on function app_private.guard_product_media_retirement_immutable()
  to service_role;

comment on function app_private.guard_product_media_retirement_immutable() is
  'Makes product-media retirement irreversible and serializes every retirement transition with catalogue attachment on the same object advisory lock.';

commit;
