\set ON_ERROR_STOP on

-- M5 canonical Store Chat authority regression.
-- Runs only against a disposable fresh Supabase database and rolls back.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'c1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'chat-buyer@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'c2000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'chat-seller@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'c3000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'chat-stranger@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'c4000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'chat-business@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles_buyer(id, display_name)
values
  ('c1000000-0000-4000-8000-000000000001', 'Chat Buyer'),
  ('c3000000-0000-4000-8000-000000000003', 'Chat Stranger'),
  ('c4000000-0000-4000-8000-000000000004', 'Chat Business Buyer');

insert into public.profiles_seller(
  id, storefront_name, business_type, verification_status, return_policy, shipping_policy
)
values (
  'c2000000-0000-4000-8000-000000000002',
  'Canonical Chat Seller', 'individual', 'verified', 'Test returns.', 'Test shipping.'
);

insert into public.profiles_business(
  id, display_name, business_kind, country, verification_status
)
values (
  'c4000000-0000-4000-8000-000000000004',
  'Canonical Business Buyer', 'retailer', 'PH', 'verified'
);

-- Public RPC surface must be narrow.
do $$
begin
  if has_function_privilege('anon', 'public.open_store_conversation(text,uuid)', 'EXECUTE') then
    raise exception 'anon unexpectedly executes open_store_conversation';
  end if;
  if has_function_privilege('anon', 'public.send_store_message(uuid,text,text,text,text)', 'EXECUTE') then
    raise exception 'anon unexpectedly executes send_store_message';
  end if;
  if has_function_privilege('anon', 'public.mark_store_conversation_read(uuid)', 'EXECUTE') then
    raise exception 'anon unexpectedly executes mark_store_conversation_read';
  end if;
  if not has_function_privilege('authenticated', 'public.open_store_conversation(text,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.send_store_message(uuid,text,text,text,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.mark_store_conversation_read(uuid)', 'EXECUTE') then
    raise exception 'authenticated role is missing reviewed Store Chat RPCs';
  end if;

  if has_table_privilege('anon', 'public.messages', 'SELECT')
     or has_table_privilege('anon', 'public.conversations', 'SELECT')
     or has_table_privilege('anon', 'public.conversation_keys', 'SELECT')
     or has_table_privilege('anon', 'public.message_key_envelopes', 'SELECT') then
    raise exception 'anonymous messaging table privilege leaked';
  end if;

  if has_table_privilege('authenticated', 'public.messages', 'INSERT')
     or has_table_privilege('authenticated', 'public.messages', 'UPDATE')
     or has_table_privilege('authenticated', 'public.conversations', 'INSERT')
     or has_table_privilege('authenticated', 'public.conversation_keys', 'SELECT')
     or has_table_privilege('authenticated', 'public.message_key_envelopes', 'SELECT') then
    raise exception 'authenticated direct Store Chat write/key privilege leaked';
  end if;
end
$$;

-- Buyer opens a verified storefront context. The database derives the seller;
-- no recipient argument exists on the RPC.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select public.open_store_conversation(
  'storefront',
  'c2000000-0000-4000-8000-000000000002'
) as conversation_id \gset

-- Idempotent open of the same authoritative context returns the same thread.
do $$
declare
  v_again uuid;
begin
  v_again := public.open_store_conversation(
    'storefront',
    'c2000000-0000-4000-8000-000000000002'
  );
  if v_again <> :'conversation_id'::uuid then
    raise exception 'Store Chat conversation open is not idempotent';
  end if;
end
$$;

-- Direct table insertion is forbidden even to an authenticated participant.
do $$
begin
  begin
    insert into public.conversations(type, participants)
    values ('general', array[
      'c1000000-0000-4000-8000-000000000001'::uuid,
      'c3000000-0000-4000-8000-000000000003'::uuid
    ]);
    raise exception 'authenticated user directly inserted a conversation';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.messages(sender_id, recipient_id, content, conversation_id)
    values (
      'c1000000-0000-4000-8000-000000000001',
      'c3000000-0000-4000-8000-000000000003',
      'plaintext bypass',
      :'conversation_id'::uuid
    );
    raise exception 'authenticated user directly inserted a message';
  exception when insufficient_privilege then null;
  end;
end
$$;

reset role;
select set_config('m5.conversation_id', :'conversation_id', false);

do $$
declare
  c public.conversations%rowtype;
begin
  select * into c
  from public.conversations
  where id = current_setting('m5.conversation_id')::uuid;

  if c.context_type <> 'storefront'
     or c.context_id <> 'c2000000-0000-4000-8000-000000000002'::uuid then
    raise exception 'conversation context was not persisted canonically';
  end if;
  if not (
    c.participant1_id in (
      'c1000000-0000-4000-8000-000000000001'::uuid,
      'c2000000-0000-4000-8000-000000000002'::uuid
    )
    and c.participant2_id in (
      'c1000000-0000-4000-8000-000000000001'::uuid,
      'c2000000-0000-4000-8000-000000000002'::uuid
    )
    and c.participant1_id <> c.participant2_id
  ) then
    raise exception 'conversation participants were not context-derived';
  end if;
  if not ('shopper' = any(array[c.participant1_role, c.participant2_role]))
     or not ('seller' = any(array[c.participant1_role, c.participant2_role])) then
    raise exception 'conversation contextual roles are incorrect';
  end if;
end
$$;

-- Simulate the trusted application key-envelope initialization. Browser roles
-- cannot perform this insert.
insert into public.message_key_envelopes(
  conversation_id, wrapped_key, wrap_iv, kek_id, key_wrap_version
) values (
  current_setting('m5.conversation_id')::uuid,
  repeat('A', 48),
  'QUFBQUFBQUFBQUFB',
  'message-kek-test',
  'kek-aes-256-gcm-v1'
);

-- Canonical send derives recipient from the conversation and emits a generic,
-- plaintext-free notification.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select public.send_store_message(
  current_setting('m5.conversation_id')::uuid,
  'QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB',
  'QUFBQUFBQUFBQUFB',
  'msg-aes-256-gcm-v1',
  'text'
) as message_id \gset

reset role;
select set_config('m5.message_id', :'message_id', false);

do $$
declare
  m public.messages%rowtype;
  n public.notifications%rowtype;
begin
  select * into m from public.messages where id = current_setting('m5.message_id')::uuid;
  if m.sender_id <> 'c1000000-0000-4000-8000-000000000001'::uuid
     or m.recipient_id <> 'c2000000-0000-4000-8000-000000000002'::uuid
     or m.conversation_id <> current_setting('m5.conversation_id')::uuid
     or not m.is_encrypted
     or m.encryption_version <> 'msg-aes-256-gcm-v1' then
    raise exception 'canonical message authority/encryption metadata is incorrect';
  end if;
  if m.order_id is not null then
    raise exception 'non-order conversation accepted spoofed order context';
  end if;

  select * into n
  from public.notifications
  where metadata->>'message_id' = m.id::text;
  if n.user_id <> m.recipient_id
     or n.type <> 'message'
     or n.title <> 'New message'
     or n.message <> 'You have a new marketplace message.' then
    raise exception 'generic message notification was not created correctly';
  end if;
  if n.message like '%QUFB%' or n.title like '%QUFB%' then
    raise exception 'ciphertext leaked into notification copy';
  end if;
end
$$;

-- Unrelated authenticated user cannot enumerate or send into the conversation.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c3000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"c3000000-0000-4000-8000-000000000003","role":"authenticated"}', true);

do $$
begin
  if exists (
    select 1 from public.conversations
    where id = current_setting('m5.conversation_id')::uuid
  ) then
    raise exception 'unrelated user read canonical conversation';
  end if;
  if exists (
    select 1 from public.messages
    where id = current_setting('m5.message_id')::uuid
  ) then
    raise exception 'unrelated user read canonical message';
  end if;

  begin
    perform public.send_store_message(
      current_setting('m5.conversation_id')::uuid,
      'QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB',
      'QUFBQUFBQUFBQUFB',
      'msg-aes-256-gcm-v1',
      'text'
    );
    raise exception 'unrelated user sent into canonical conversation';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.open_store_conversation(
      'storefront',
      'c3000000-0000-4000-8000-000000000003'
    );
    raise exception 'non-seller UUID was accepted as a storefront conversation target';
  exception when invalid_parameter_value then null;
  end;
end
$$;

-- Verified Business buyer receives a business_buyer role, not a permanent
-- single-role replacement of its buyer identity.
select set_config('request.jwt.claim.sub', 'c4000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"c4000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select public.open_store_conversation(
  'storefront',
  'c2000000-0000-4000-8000-000000000002'
) as business_conversation_id \gset
reset role;

do $$
begin
  if not exists (
    select 1 from public.conversations c
    where c.id = :'business_conversation_id'::uuid
      and 'business_buyer' = any(array[c.participant1_role, c.participant2_role])
      and 'seller' = any(array[c.participant1_role, c.participant2_role])
  ) then
    raise exception 'Business buyer contextual role was not preserved';
  end if;
end
$$;

-- Capability suspension blocks new sends without destroying conversation history.
insert into public.marketplace_capability_states(
  user_id, capability, status, reason, suspended_at, suspended_by
) values (
  'c1000000-0000-4000-8000-000000000001',
  'buyer', 'suspended', 'M5 regression', now(),
  'c2000000-0000-4000-8000-000000000002'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

do $$
begin
  begin
    perform public.send_store_message(
      current_setting('m5.conversation_id')::uuid,
      'QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB',
      'QUFBQUFBQUFBQUFB',
      'msg-aes-256-gcm-v1',
      'text'
    );
    raise exception 'suspended Buyer sent a Store Chat message';
  exception when insufficient_privilege then null;
  end;

  if not exists (
    select 1 from public.messages where id = current_setting('m5.message_id')::uuid
  ) then
    raise exception 'capability suspension destroyed historical message visibility';
  end if;

  begin
    perform * from public.message_key_envelopes;
    raise exception 'authenticated user read server-only message key envelopes';
  exception when insufficient_privilege then null;
  end;

  begin
    perform * from public.conversation_keys;
    raise exception 'authenticated user read legacy raw conversation keys';
  exception when insufficient_privilege then null;
  end;
end
$$;

rollback;
