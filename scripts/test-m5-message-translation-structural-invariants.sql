\set ON_ERROR_STOP on

-- Translation cache catalog contract. The cache is a derived, encrypted,
-- server-only surface; browser roles must not gain any table access.
do $$
declare
  public_table_count integer;
begin
  select count(*) into public_table_count
  from information_schema.tables
  where table_schema = 'public'
    and table_type = 'BASE TABLE';

  if public_table_count <> 50 then
    raise exception 'canonical public physical table count changed after translation cache: %', public_table_count;
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'message_translations'
      and c.relkind = 'r'
      and c.relrowsecurity
  ) then
    raise exception 'message_translations must remain an RLS-enabled physical table';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'message_translations'
  ) then
    raise exception 'message_translations must remain browser-policy-free';
  end if;

  if has_table_privilege('anon', 'public.message_translations', 'SELECT')
     or has_table_privilege('authenticated', 'public.message_translations', 'SELECT')
     or has_table_privilege('anon', 'public.message_translations', 'INSERT')
     or has_table_privilege('authenticated', 'public.message_translations', 'INSERT')
     or has_table_privilege('authenticated', 'public.message_translations', 'UPDATE')
     or has_table_privilege('authenticated', 'public.message_translations', 'DELETE') then
    raise exception 'browser translation-cache privilege leaked';
  end if;

  if not has_table_privilege('service_role', 'public.message_translations', 'SELECT')
     or not has_table_privilege('service_role', 'public.message_translations', 'INSERT')
     or not has_table_privilege('service_role', 'public.message_translations', 'UPDATE')
     or not has_table_privilege('service_role', 'public.message_translations', 'DELETE') then
    raise exception 'service translation-cache privilege missing';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'message_translations'
      and column_name in ('original_text', 'translated_text', 'plaintext', 'translation_text')
  ) then
    raise exception 'plaintext translation/original column introduced';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'message_translations'
      and column_name = 'original_integrity_digest'
  ) then
    raise exception 'keyed original integrity digest column missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'message_translations'
      and indexname = 'idx_message_translations_message'
  ) or not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'message_translations'
      and indexname = 'idx_message_translations_recoverable_claim'
  ) then
    raise exception 'translation cache lookup/recovery index missing';
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'message_translations'
      and c.conname = 'message_translations_unique_cache_entry'
      and c.contype = 'u'
  ) then
    raise exception 'translation idempotency unique constraint missing';
  end if;
end;
$$;

select 'M5 message translation structural invariants verified' as result;
