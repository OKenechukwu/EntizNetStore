-- P0 product-media lifecycle integrity.
--
-- Product-media catalogue references and physical Storage deletion must share a
-- single authority boundary. A post-commit "is this referenced?" check alone is
-- racy: another product can attach the same clean object between that check and
-- physical deletion. We close the window by retiring scanner provenance under
-- the same per-object transaction advisory lock used by authenticated inserts.
-- Once retired, no new Seller catalogue reference can attach the object.

begin;

alter table public.upload_scan_jobs
  add column if not exists retired_at timestamptz;

alter table public.upload_scan_jobs
  add constraint upload_scan_jobs_product_media_retirement_check
  check (retired_at is null or purpose = 'product_media');

create index if not exists idx_upload_scan_jobs_product_media_retired
  on public.upload_scan_jobs(actor_id, destination_path, retired_at)
  where purpose = 'product_media' and destination_bucket = 'product-media';

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

  if v_object_name !~ (
    '^' || v_user_id::text ||
    '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|png|webp)$'
  ) then
    raise exception 'product_media_path_not_owned' using errcode = '42501';
  end if;

  -- Catalogue attachment and retirement serialize on the same object key. This
  -- turns "retire if unreferenced" into an atomic lifecycle transition instead
  -- of a check/delete race across two independent systems.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('entiznetstore:product-media:' || v_object_name, 0)
  );

  select j.verified_mime
    into v_verified_mime
  from public.upload_scan_jobs j
  where j.actor_id = v_user_id
    and j.purpose = 'product_media'
    and j.destination_bucket = 'product-media'
    and j.destination_path = v_object_name
    and j.status = 'clean'
    and j.retired_at is null
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
      and coalesce((to_jsonb(o) ->> 'is_delete_marker')::boolean, false) = false
      and (to_jsonb(o) ->> 'archived_at') is null
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

create or replace function public.service_claim_product_media_orphan(
  p_actor_id uuid,
  p_destination_path text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_suffix text;
  v_job_id uuid;
  v_retired_at timestamptz;
begin
  if p_actor_id is null
     or p_destination_path is null
     or p_destination_path !~ (
       '^' || p_actor_id::text ||
       '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|png|webp)$'
     ) then
    return 'invalid_path';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('entiznetstore:product-media:' || p_destination_path, 0)
  );

  v_suffix := '/storage/v1/object/public/product-media/' || p_destination_path;

  if exists (
    select 1
    from public.product_media pm
    where right(
      split_part(split_part(pm.url, '#', 1), '?', 1),
      char_length(v_suffix)
    ) = v_suffix
  ) then
    return 'referenced';
  end if;

  select j.id, j.retired_at
    into v_job_id, v_retired_at
  from public.upload_scan_jobs j
  where j.actor_id = p_actor_id
    and j.purpose = 'product_media'
    and j.destination_bucket = 'product-media'
    and j.destination_path = p_destination_path
    and j.status = 'clean'
    and j.verified_mime in ('image/jpeg', 'image/png', 'image/webp')
    and j.byte_size is not null
    and j.sha256 is not null
    and j.scanner is not null
    and j.scanner_result_code is not null
    and j.scanned_at is not null
    and j.promoted_at is not null
  limit 1
  for update;

  if v_job_id is null then
    return 'not_found';
  end if;

  if v_retired_at is null then
    update public.upload_scan_jobs
    set retired_at = now(), updated_at = now()
    where id = v_job_id;
  end if;

  return 'claimed';
end;
$$;

revoke all on function public.service_claim_product_media_orphan(uuid, text)
  from public, anon, authenticated;
grant execute on function public.service_claim_product_media_orphan(uuid, text)
  to service_role;

comment on column public.upload_scan_jobs.retired_at is
  'For product media, marks scanner provenance as permanently retired before physical object deletion. Retired objects cannot be reattached by authenticated Seller RPCs.';

comment on function public.service_claim_product_media_orphan(uuid, text) is
  'Service-only atomic orphan claim. Serializes with product-media attachment, refuses referenced paths, and retires scanner provenance before Storage deletion.';

commit;
