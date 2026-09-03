\set ON_ERROR_STOP on

-- M5 hosted-shape regression. This intentionally checks catalog structure rather
-- than application fixtures so advisor-discovered schema mistakes fail CI before
-- Store Chat code can be released.
do $$
declare
  public_table_count integer;
  envelope_kind "char";
  envelope_options text[];
  wrapper regprocedure;
  authority regprocedure;
begin
  select count(*) into public_table_count
  from information_schema.tables
  where table_schema = 'public'
    and table_type = 'BASE TABLE';

  if public_table_count <> 49 then
    raise exception 'canonical public physical table count changed: %', public_table_count;
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'conversations'
      and indexname = 'idx_conversations_created_by'
      and indexdef ilike '%(created_by)%'
  ) then
    raise exception 'conversations.created_by foreign key lost its covering index';
  end if;

  select c.relkind, c.reloptions
  into envelope_kind, envelope_options
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'message_key_envelopes';

  if envelope_kind is distinct from 'v'::"char"
     or envelope_options is null
     or not ('security_invoker=true' = any(envelope_options)) then
    raise exception 'message_key_envelopes must remain a security-invoker view';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'conversation_keys'
      and column_name = 'encrypted_key'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'conversation_keys'
      and column_name = 'wrapped_key'
  ) then
    raise exception 'conversation key persistence reverted to raw/legacy semantics';
  end if;

  if has_table_privilege('anon', 'public.conversation_keys', 'SELECT')
     or has_table_privilege('authenticated', 'public.conversation_keys', 'SELECT')
     or has_table_privilege('anon', 'public.message_key_envelopes', 'SELECT')
     or has_table_privilege('authenticated', 'public.message_key_envelopes', 'SELECT') then
    raise exception 'browser key-envelope privilege leaked';
  end if;

  foreach wrapper in array array[
    'public.open_store_conversation(text,uuid)'::regprocedure,
    'public.send_store_message(uuid,text,text,text,text)'::regprocedure,
    'public.mark_store_conversation_read(uuid)'::regprocedure
  ] loop
    if (select p.prosecdef from pg_proc p where p.oid = wrapper::oid) then
      raise exception 'public Store Chat wrapper became SECURITY DEFINER: %', wrapper;
    end if;
    if has_function_privilege('anon', wrapper, 'EXECUTE')
       or not has_function_privilege('authenticated', wrapper, 'EXECUTE') then
      raise exception 'public Store Chat wrapper privilege changed: %', wrapper;
    end if;
  end loop;

  foreach authority in array array[
    'app_private.open_store_conversation_authority(text,uuid)'::regprocedure,
    'app_private.send_store_message_authority(uuid,text,text,text,text)'::regprocedure,
    'app_private.mark_store_conversation_read_authority(uuid)'::regprocedure
  ] loop
    if not (select p.prosecdef from pg_proc p where p.oid = authority::oid) then
      raise exception 'private Store Chat authority lost SECURITY DEFINER: %', authority;
    end if;
    if has_function_privilege('anon', authority, 'EXECUTE') then
      raise exception 'anonymous Store Chat authority execution leaked: %', authority;
    end if;
  end loop;
end;
$$;

select 'M5 Store Chat structural invariants verified' as result;
