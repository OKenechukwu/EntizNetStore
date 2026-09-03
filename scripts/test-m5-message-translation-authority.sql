\set ON_ERROR_STOP on

-- Disposable fresh-database regression for translation authorization and
-- provider-call claim arbitration. All fixture state is rolled back.
begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'd1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'translation-buyer@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd2000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'translation-seller@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles_buyer(id, display_name)
values ('d1000000-0000-4000-8000-000000000001', 'Translation Buyer');

insert into public.profiles_seller(
  id, storefront_name, business_type, verification_status, return_policy, shipping_policy
)
values (
  'd2000000-0000-4000-8000-000000000002',
  'Translation Seller', 'individual', 'verified', 'Test returns.', 'Test shipping.'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.open_store_conversation(
  'storefront', 'd2000000-0000-4000-8000-000000000002'
) as conversation_id \gset
select set_config('translation.conversation_id', :'conversation_id', true);
reset role;

insert into public.message_key_envelopes(
  conversation_id, wrapped_key, wrap_iv, kek_id, key_wrap_version
) values (
  current_setting('translation.conversation_id')::uuid,
  repeat('A', 48), 'QUFBQUFBQUFBQUFB', 'message-kek-test', 'kek-aes-256-gcm-v1'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.send_store_message(
  current_setting('translation.conversation_id')::uuid,
  'QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB',
  'QUFBQUFBQUFBQUFB',
  'msg-aes-256-gcm-v1',
  'text'
) as message_id \gset
select set_config('translation.message_id', :'message_id', true);

do $$
begin
  begin
    perform * from public.message_translations;
    raise exception 'authenticated browser read translation cache';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.message_translations(
      message_id, target_language, provider, provider_version,
      original_integrity_digest, status, claim_token, claimed_at, lease_expires_at
    ) values (
      current_setting('translation.message_id')::uuid,
      'es', 'test-provider', 'v1', repeat('a', 64),
      'pending', gen_random_uuid(), now(), now() + interval '30 seconds'
    );
    raise exception 'authenticated browser wrote translation cache';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

set local role service_role;
insert into public.message_translations(
  message_id, target_language, provider, provider_version,
  original_integrity_digest, status, claim_token, claimed_at, lease_expires_at
) values (
  current_setting('translation.message_id')::uuid,
  'es', 'test-provider', 'v1', repeat('a', 64),
  'pending', 'd3000000-0000-4000-8000-000000000003', now() - interval '1 minute', now() - interval '1 second'
) returning id as translation_id \gset
select set_config('translation.translation_id', :'translation_id', true);

do $$
begin
  begin
    insert into public.message_translations(
      message_id, target_language, provider, provider_version,
      original_integrity_digest, status, claim_token, claimed_at, lease_expires_at
    ) values (
      current_setting('translation.message_id')::uuid,
      'es', 'test-provider', 'v1', repeat('a', 64),
      'pending', gen_random_uuid(), now(), now() + interval '30 seconds'
    );
    raise exception 'duplicate translation claim bypassed unique cache constraint';
  exception when unique_violation then null;
  end;
end;
$$;

do $$
declare
  affected integer;
begin
  update public.message_translations
  set claim_token = 'd4000000-0000-4000-8000-000000000004',
      claimed_at = now(),
      lease_expires_at = now() + interval '30 seconds',
      attempt_count = attempt_count + 1,
      updated_at = now()
  where id = current_setting('translation.translation_id')::uuid
    and status in ('pending', 'failed')
    and lease_expires_at <= now();
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'stale translation claim was not recoverable exactly once';
  end if;

  if not exists (
    select 1
    from public.message_translations
    where id = current_setting('translation.translation_id')::uuid
      and attempt_count = 2
      and claim_token = 'd4000000-0000-4000-8000-000000000004'::uuid
  ) then
    raise exception 'translation provider idempotency row identity changed across takeover';
  end if;

  update public.message_translations
  set claim_token = gen_random_uuid(),
      lease_expires_at = now() + interval '30 seconds'
  where id = current_setting('translation.translation_id')::uuid
    and status in ('pending', 'failed')
    and lease_expires_at <= now();
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'active translation claim could be stolen before lease expiry';
  end if;
end;
$$;

update public.message_translations
set source_language = 'en',
    status = 'ready',
    ciphertext = 'QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB',
    encryption_iv = 'QUFBQUFBQUFBQUFB',
    encryption_version = 'translation-aes-256-gcm-v1',
    claim_token = null,
    translated_at = now(),
    updated_at = now()
where id = current_setting('translation.translation_id')::uuid;

do $$
begin
  if not exists (
    select 1 from public.message_translations
    where id = current_setting('translation.translation_id')::uuid
      and status = 'ready'
      and source_language = 'en'
      and translated_at is not null
      and claim_token is null
  ) then
    raise exception 'service role could not complete encrypted translation cache row';
  end if;
end;
$$;

reset role;
rollback;