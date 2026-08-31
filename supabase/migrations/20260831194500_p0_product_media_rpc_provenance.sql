-- P0 product-media authority hardening.
--
-- The Seller product API already verifies product-media ownership before calling
-- seller_save_product_v3, but that RPC is intentionally executable by the
-- authenticated role and can therefore be invoked directly through PostgREST.
-- The database must not trust the application route as its only provenance
-- boundary. This trigger makes every authenticated product_media mutation prove
-- that the URL is canonical for the caller, that the object exists in the
-- caller's product-media namespace, and that the exact object was promoted by
-- the quarantine/scanner pipeline.

begin;

create or replace function app_private.guard_product_media_provenance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_jwt jsonb := auth.jwt();
  v_role text := coalesce(v_jwt ->> 'role', current_setting('request.jwt.claim.role', true));
  v_user_id uuid := auth.uid();
  v_issuer text := nullif(v_jwt ->> 'iss', '');
  v_origin text;
  v_prefix text;
  v_object_name text;
  v_product_owner uuid;
  v_verified_mime text;
begin
  -- Trusted SQL/service-role maintenance already has total database authority.
  -- This guard is specifically the browser-authenticated Seller trust boundary.
  if v_role is distinct from 'authenticated' then
    return new;
  end if;

  if v_user_id is null then
    raise exception 'product_media_authenticated_context_required' using errcode = '28000';
  end if;

  select p.seller_id
    into v_product_owner
  from public.products p
  where p.id = new.product_id;

  if v_product_owner is null or v_product_owner <> v_user_id then
    raise exception 'product_media_product_access_denied' using errcode = '42501';
  end if;

  -- Hosted Supabase JWTs bind media URLs to the project/custom-domain origin.
  -- CI/local development may use only loopback HTTP. Missing/malformed issuer
  -- claims fail closed instead of silently weakening direct-RPC calls.
  if v_issuer is null or not (
    v_issuer ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?/auth/v1/?$'
    or v_issuer ~ '^http://(127[.]0[.]0[.]1|localhost)(:[0-9]{1,5})?/auth/v1/?$'
  ) then
    raise exception 'product_media_auth_issuer_invalid' using errcode = '42501';
  end if;

  v_origin := regexp_replace(v_issuer, '/auth/v1/?$', '');
  v_prefix := v_origin || '/storage/v1/object/public/product-media/';

  if new.type is distinct from 'image'
     or new.url is null
     or new.url <> btrim(new.url)
     or left(new.url, length(v_prefix)) <> v_prefix
     or position('?' in new.url) > 0
     or position('#' in new.url) > 0
     or position('%' in new.url) > 0
     or position(chr(92) in new.url) > 0 then
    raise exception 'product_media_url_not_canonical' using errcode = '22023';
  end if;

  v_object_name := substring(new.url from length(v_prefix) + 1);

  -- Product media paths are minted by the server as
  -- <seller UUID>/<random UUID>.(jpg|png|webp). Requiring that exact shape
  -- removes traversal/alias ambiguity and cross-Seller object reuse.
  if v_object_name !~ (
    '^' || v_user_id::text ||
    '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|png|webp)$'
  ) then
    raise exception 'product_media_path_not_owned' using errcode = '42501';
  end if;

  select j.verified_mime
    into v_verified_mime
  from public.upload_scan_jobs j
  where j.actor_id = v_user_id
    and j.purpose = 'product_media'
    and j.destination_bucket = 'product-media'
    and j.destination_path = v_object_name
    and j.status = 'clean'
    and j.verified_mime in ('image/jpeg', 'image/png', 'image/webp')
    and j.byte_size is not null
    and j.sha256 is not null
    and j.scanner is not null
    and j.scanner_result_code is not null
    and j.scanned_at is not null
    and j.promoted_at is not null
  limit 1;

  if v_verified_mime is null then
    raise exception 'product_media_scan_provenance_required' using errcode = '42501';
  end if;

  if not (
    (v_verified_mime = 'image/jpeg' and v_object_name ~ '[.]jpg$')
    or (v_verified_mime = 'image/png' and v_object_name ~ '[.]png$')
    or (v_verified_mime = 'image/webp' and v_object_name ~ '[.]webp$')
  ) then
    raise exception 'product_media_extension_mismatch' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'product-media'
      and o.name = v_object_name
      and coalesce(o.is_delete_marker, false) = false
      and o.archived_at is null
  ) then
    raise exception 'product_media_object_missing' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function app_private.guard_product_media_provenance()
  from public, anon, authenticated;
grant execute on function app_private.guard_product_media_provenance()
  to service_role;

drop trigger if exists trg_guard_product_media_provenance on public.product_media;
create trigger trg_guard_product_media_provenance
before insert or update of product_id, type, url
on public.product_media
for each row
execute function app_private.guard_product_media_provenance();

comment on function app_private.guard_product_media_provenance() is
  'Fail-closed provenance guard for authenticated Seller product media. Requires canonical same-project URL, owned UUID path, clean quarantine scan evidence, and a live storage object.';

commit;
