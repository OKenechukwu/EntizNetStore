-- P0 upload quarantine/scanning database boundary regression.
-- This suite proves that the quarantine bucket is private, the scan ledger is
-- service-role-only, and PostgreSQL itself rejects cross-purpose/cross-owner or
-- evidence-free clean-state rows.

begin;

DO $$
DECLARE
  v_public boolean;
  v_limit bigint;
  v_mimes text[];
  v_rls boolean;
  v_actor uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_failed boolean;
BEGIN
  select b.public, b.file_size_limit, b.allowed_mime_types
    into v_public, v_limit, v_mimes
  from storage.buckets b
  where b.id = 'upload-quarantine';

  if not found then
    raise exception 'upload-quarantine bucket is missing';
  end if;
  if v_public then
    raise exception 'upload-quarantine bucket must remain private';
  end if;
  if v_limit <> 15728640 then
    raise exception 'upload-quarantine file size limit drifted: %', v_limit;
  end if;
  if not v_mimes @> array['application/pdf','image/jpeg','image/png','image/webp']::text[] then
    raise exception 'upload-quarantine allowed MIME set is incomplete: %', v_mimes;
  end if;

  select c.relrowsecurity
    into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'upload_scan_jobs';

  if coalesce(v_rls, false) is not true then
    raise exception 'upload_scan_jobs must have RLS enabled';
  end if;

  if has_table_privilege('public', 'public.upload_scan_jobs', 'SELECT')
     or has_table_privilege('anon', 'public.upload_scan_jobs', 'SELECT')
     or has_table_privilege('authenticated', 'public.upload_scan_jobs', 'SELECT')
     or has_table_privilege('anon', 'public.upload_scan_jobs', 'INSERT')
     or has_table_privilege('authenticated', 'public.upload_scan_jobs', 'INSERT')
     or has_table_privilege('anon', 'public.upload_scan_jobs', 'UPDATE')
     or has_table_privilege('authenticated', 'public.upload_scan_jobs', 'UPDATE')
     or has_table_privilege('anon', 'public.upload_scan_jobs', 'DELETE')
     or has_table_privilege('authenticated', 'public.upload_scan_jobs', 'DELETE') then
    raise exception 'upload_scan_jobs leaked privileges to public/anon/authenticated';
  end if;

  if not has_table_privilege('service_role', 'public.upload_scan_jobs', 'SELECT')
     or not has_table_privilege('service_role', 'public.upload_scan_jobs', 'INSERT')
     or not has_table_privilege('service_role', 'public.upload_scan_jobs', 'UPDATE')
     or not has_table_privilege('service_role', 'public.upload_scan_jobs', 'DELETE') then
    raise exception 'service_role upload_scan_jobs privileges are incomplete';
  end if;

  -- Create ephemeral auth users so FK and ownership constraints are exercised.
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
  ) values
    (v_actor, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'quarantine-actor@example.test', '', now(), now(), now()),
    (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'quarantine-other@example.test', '', now(), now(), now());

  insert into public.upload_scan_jobs (
    id, actor_id, purpose, quarantine_path, destination_bucket,
    destination_path, declared_mime, status
  ) values (
    gen_random_uuid(), v_actor, 'product_media',
    v_actor::text || '/product_media/pending.png',
    'product-media', v_actor::text || '/pending.png', 'image/png', 'pending_upload'
  );

  v_failed := false;
  begin
    insert into public.upload_scan_jobs (
      id, actor_id, purpose, quarantine_path, destination_bucket,
      destination_path, declared_mime, status
    ) values (
      gen_random_uuid(), v_actor, 'kyc',
      v_actor::text || '/kyc/wrong-bucket.png',
      'product-media', v_actor::text || '/wrong-bucket.png', 'image/png', 'pending_upload'
    );
  exception when check_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'purpose/destination mismatch was accepted';
  end if;

  v_failed := false;
  begin
    insert into public.upload_scan_jobs (
      id, actor_id, purpose, quarantine_path, destination_bucket,
      destination_path, declared_mime, status
    ) values (
      gen_random_uuid(), v_actor, 'product_media',
      v_other::text || '/product_media/cross-owner.png',
      'product-media', v_actor::text || '/cross-owner.png', 'image/png', 'pending_upload'
    );
  exception when check_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'cross-owner quarantine path was accepted';
  end if;

  v_failed := false;
  begin
    insert into public.upload_scan_jobs (
      id, actor_id, purpose, quarantine_path, destination_bucket,
      destination_path, declared_mime, status
    ) values (
      gen_random_uuid(), v_actor, 'product_media',
      v_actor::text || '/product_media/false-clean.png',
      'product-media', v_actor::text || '/false-clean.png', 'image/png', 'clean'
    );
  exception when check_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'clean status without scan evidence was accepted';
  end if;

  delete from public.upload_scan_jobs where actor_id in (v_actor, v_other);
  delete from auth.users where id in (v_actor, v_other);
END;
$$;

rollback;

select 'upload quarantine database boundary regression passed' as result;
