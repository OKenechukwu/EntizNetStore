-- EntizNetStore M5 — canonical marketplace conversation authority.
--
-- This is an expand-safe forward migration. Legacy messaging columns remain for
-- rollback/read compatibility, but all new conversation/message creation moves
-- behind context-derived authenticated RPCs. Browser roles cannot choose an
-- arbitrary recipient or write directly to messaging tables.

begin;

create schema if not exists app_private;

-- ---------------------------------------------------------------------------
-- Canonical conversation shape
-- ---------------------------------------------------------------------------
alter table public.conversations
  add column participant1_id uuid references auth.users(id) on delete cascade,
  add column participant2_id uuid references auth.users(id) on delete cascade,
  add column participant1_role text,
  add column participant2_role text,
  add column context_type text not null default 'legacy',
  add column context_id uuid,
  add column created_by uuid references auth.users(id) on delete set null,
  add column status text not null default 'active';

-- Preserve any pre-existing two-party conversations as legacy records while
-- canonicalizing their participant order. Production is currently empty, but
-- this makes the forward migration safe against a race with an old deployment.
update public.conversations
set participant1_id = case
      when participants[1] < participants[2] then participants[1]
      else participants[2]
    end,
    participant2_id = case
      when participants[1] < participants[2] then participants[2]
      else participants[1]
    end,
    participants = array[
      case when participants[1] < participants[2] then participants[1] else participants[2] end,
      case when participants[1] < participants[2] then participants[2] else participants[1] end
    ]::uuid[]
where cardinality(participants) = 2
  and participants[1] is not null
  and participants[2] is not null
  and participants[1] <> participants[2];

alter table public.conversations
  add constraint conversations_status_check
    check (status in ('active', 'closed')),
  add constraint conversations_context_type_check
    check (context_type in ('legacy', 'product', 'storefront', 'order', 'wholesale_offer')),
  add constraint conversations_participant_role_check
    check (
      (participant1_role is null or participant1_role in ('shopper', 'seller', 'business_buyer', 'business_supplier'))
      and
      (participant2_role is null or participant2_role in ('shopper', 'seller', 'business_buyer', 'business_supplier'))
    ),
  add constraint conversations_canonical_context_shape_check
    check (
      context_type = 'legacy'
      or (
        context_id is not null
        and participant1_id is not null
        and participant2_id is not null
        and participant1_id <> participant2_id
        and participant1_id < participant2_id
        and participant1_role is not null
        and participant2_role is not null
        and participants = array[participant1_id, participant2_id]::uuid[]
      )
    );

create unique index idx_conversations_context_participants_unique
  on public.conversations(context_type, context_id, participant1_id, participant2_id)
  where context_type <> 'legacy';
create index idx_conversations_participant1_last
  on public.conversations(participant1_id, last_message_at desc)
  where participant1_id is not null;
create index idx_conversations_participant2_last
  on public.conversations(participant2_id, last_message_at desc)
  where participant2_id is not null;

-- ---------------------------------------------------------------------------
-- Server-only data-key envelopes. The wrapped data key is stored in Postgres;
-- the KEK itself must remain in the trusted application environment.
-- ---------------------------------------------------------------------------
create table public.message_key_envelopes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.conversations(id) on delete cascade,
  wrapped_key text not null,
  wrap_iv text not null,
  kek_id text not null,
  key_wrap_version text not null default 'kek-aes-256-gcm-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_key_envelopes_wrapped_key_length_check
    check (char_length(wrapped_key) between 40 and 1024),
  constraint message_key_envelopes_wrap_iv_length_check
    check (char_length(wrap_iv) between 16 and 128),
  constraint message_key_envelopes_kek_id_length_check
    check (char_length(kek_id) between 3 and 128),
  constraint message_key_envelopes_version_check
    check (key_wrap_version = 'kek-aes-256-gcm-v1')
);

alter table public.message_key_envelopes enable row level security;
revoke all on public.message_key_envelopes from public, anon, authenticated;
grant all on public.message_key_envelopes to service_role;

alter table public.messages
  add column encryption_version text;

create index if not exists idx_messages_conversation_created
  on public.messages(conversation_id, created_at asc)
  where conversation_id is not null;
create index if not exists idx_messages_sender_created
  on public.messages(sender_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Contextual role helpers. They are private implementation details and are not
-- browser-callable RPCs.
-- ---------------------------------------------------------------------------
create or replace function app_private.store_chat_role_is_active(
  p_user_id uuid,
  p_role text
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  if p_user_id is null then
    return false;
  end if;

  if p_role = 'shopper' then
    return public.marketplace_capability_is_active(p_user_id, 'buyer');
  end if;

  if p_role = 'seller' then
    return public.marketplace_capability_is_active(p_user_id, 'seller')
      and exists (
        select 1 from public.profiles_seller s
        where s.id = p_user_id and s.verification_status = 'verified'
      );
  end if;

  if p_role = 'business_buyer' then
    return public.marketplace_capability_is_active(p_user_id, 'business')
      and exists (
        select 1 from public.profiles_business b
        where b.id = p_user_id and b.verification_status = 'verified'
      );
  end if;

  if p_role = 'business_supplier' then
    return public.marketplace_capability_is_active(p_user_id, 'business')
      and public.marketplace_capability_is_active(p_user_id, 'seller')
      and exists (
        select 1
        from public.profiles_business b
        join public.profiles_seller s on s.id = b.id
        where b.id = p_user_id
          and b.verification_status = 'verified'
          and s.verification_status = 'verified'
      );
  end if;

  return false;
end;
$$;

revoke all on function app_private.store_chat_role_is_active(uuid,text)
  from public, anon, authenticated;
grant execute on function app_private.store_chat_role_is_active(uuid,text)
  to service_role;

create or replace function app_private.store_chat_existing_buyer_role(
  p_user_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  if exists (
    select 1 from public.profiles_business b
    where b.id = p_user_id and b.verification_status = 'verified'
  ) then
    return 'business_buyer';
  end if;
  return 'shopper';
end;
$$;

revoke all on function app_private.store_chat_existing_buyer_role(uuid)
  from public, anon, authenticated;
grant execute on function app_private.store_chat_existing_buyer_role(uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Open/reuse a conversation from an authoritative marketplace context.
-- No recipient ID is accepted: the counterparty is derived from the context.
-- ---------------------------------------------------------------------------
create or replace function public.open_store_conversation(
  p_context_type text,
  p_context_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_actor uuid := auth.uid();
  v_context text := lower(btrim(coalesce(p_context_type, '')));
  v_other uuid;
  v_actor_role text;
  v_other_role text;
  v_p1 uuid;
  v_p2 uuid;
  v_r1 text;
  v_r2 text;
  v_subject text;
  v_conversation_id uuid;
  v_order record;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_context_id is null or v_context not in ('product', 'storefront', 'order', 'wholesale_offer') then
    raise exception 'invalid_conversation_context' using errcode = '22023';
  end if;

  if v_context = 'product' then
    select p.seller_id into v_other
    from public.products p
    join public.profiles_seller s on s.id = p.seller_id
    where p.id = p_context_id
      and p.status = 'active'
      and p.moderation_status = 'approved'
      and s.verification_status = 'verified'
      and public.marketplace_capability_is_active(p.seller_id, 'seller');

    if v_other is null then
      raise exception 'conversation_context_not_available' using errcode = '22023';
    end if;
    if app_private.store_chat_role_is_active(v_actor, 'business_buyer') then
      v_actor_role := 'business_buyer';
    elsif app_private.store_chat_role_is_active(v_actor, 'shopper') then
      v_actor_role := 'shopper';
    else
      raise exception 'buyer_or_business_capability_required' using errcode = '42501';
    end if;
    v_other_role := 'seller';
    v_subject := 'Product inquiry';

  elsif v_context = 'storefront' then
    select s.id into v_other
    from public.profiles_seller s
    where s.id = p_context_id
      and s.verification_status = 'verified'
      and public.marketplace_capability_is_active(s.id, 'seller');

    if v_other is null then
      raise exception 'conversation_context_not_available' using errcode = '22023';
    end if;
    if app_private.store_chat_role_is_active(v_actor, 'business_buyer') then
      v_actor_role := 'business_buyer';
    elsif app_private.store_chat_role_is_active(v_actor, 'shopper') then
      v_actor_role := 'shopper';
    else
      raise exception 'buyer_or_business_capability_required' using errcode = '42501';
    end if;
    v_other_role := 'seller';
    v_subject := 'Store inquiry';

  elsif v_context = 'wholesale_offer' then
    select w.seller_id into v_other
    from public.wholesale_offers w
    join public.products p on p.id = w.product_id and p.seller_id = w.seller_id
    join public.profiles_business b on b.id = w.seller_id
    join public.profiles_seller s on s.id = w.seller_id
    where w.id = p_context_id
      and w.status = 'active'
      and (w.starts_at is null or w.starts_at <= now())
      and (w.ends_at is null or w.ends_at > now())
      and p.status = 'active'
      and p.moderation_status = 'approved'
      and b.verification_status = 'verified'
      and s.verification_status = 'verified'
      and public.marketplace_capability_is_active(w.seller_id, 'business')
      and public.marketplace_capability_is_active(w.seller_id, 'seller');

    if v_other is null then
      raise exception 'conversation_context_not_available' using errcode = '22023';
    end if;
    if not app_private.store_chat_role_is_active(v_actor, 'business_buyer') then
      raise exception 'verified_business_capability_required' using errcode = '42501';
    end if;
    v_actor_role := 'business_buyer';
    v_other_role := 'business_supplier';
    v_subject := 'Wholesale inquiry';

  else
    select o.buyer_id, o.seller_id into v_order
    from public.orders o
    where o.id = p_context_id
      and (o.buyer_id = v_actor or o.seller_id = v_actor);

    if v_order.buyer_id is null or v_order.seller_id is null then
      raise exception 'conversation_context_not_available' using errcode = '42501';
    end if;

    if v_actor = v_order.buyer_id then
      v_other := v_order.seller_id;
      if app_private.store_chat_role_is_active(v_actor, 'business_buyer') then
        v_actor_role := 'business_buyer';
      elsif app_private.store_chat_role_is_active(v_actor, 'shopper') then
        v_actor_role := 'shopper';
      else
        raise exception 'buyer_or_business_capability_required' using errcode = '42501';
      end if;
      v_other_role := 'seller';
    else
      v_other := v_order.buyer_id;
      v_actor_role := 'seller';
      if not app_private.store_chat_role_is_active(v_actor, v_actor_role) then
        raise exception 'seller_capability_required' using errcode = '42501';
      end if;
      v_other_role := app_private.store_chat_existing_buyer_role(v_other);
    end if;
    v_subject := 'Order conversation';
  end if;

  if v_other is null or v_other = v_actor then
    raise exception 'conversation_counterparty_invalid' using errcode = '22023';
  end if;

  if v_actor < v_other then
    v_p1 := v_actor;
    v_p2 := v_other;
    v_r1 := v_actor_role;
    v_r2 := v_other_role;
  else
    v_p1 := v_other;
    v_p2 := v_actor;
    v_r1 := v_other_role;
    v_r2 := v_actor_role;
  end if;

  select c.id into v_conversation_id
  from public.conversations c
  where c.context_type = v_context
    and c.context_id = p_context_id
    and c.participant1_id = v_p1
    and c.participant2_id = v_p2
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  begin
    insert into public.conversations(
      type, subject, participants,
      participant1_id, participant2_id,
      participant1_role, participant2_role,
      context_type, context_id, created_by,
      status, metadata, last_message_at, created_at, updated_at
    ) values (
      v_context, v_subject, array[v_p1, v_p2]::uuid[],
      v_p1, v_p2, v_r1, v_r2,
      v_context, p_context_id, v_actor,
      'active', '{}'::jsonb, now(), now(), now()
    ) returning id into v_conversation_id;
  exception when unique_violation then
    select c.id into v_conversation_id
    from public.conversations c
    where c.context_type = v_context
      and c.context_id = p_context_id
      and c.participant1_id = v_p1
      and c.participant2_id = v_p2
    limit 1;
  end;

  if v_conversation_id is null then
    raise exception 'conversation_open_failed' using errcode = '55000';
  end if;

  return v_conversation_id;
end;
$$;

revoke all on function public.open_store_conversation(text,uuid) from public, anon;
grant execute on function public.open_store_conversation(text,uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Canonical encrypted message write. Recipient and optional order context are
-- always derived from the conversation. No direct browser table insert remains.
-- ---------------------------------------------------------------------------
create or replace function public.send_store_message(
  p_conversation_id uuid,
  p_ciphertext text,
  p_iv text,
  p_encryption_version text,
  p_message_type text default 'text'
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_actor uuid := auth.uid();
  v_conversation public.conversations%rowtype;
  v_actor_role text;
  v_recipient uuid;
  v_message_id uuid;
  v_order_id uuid;
  v_count bigint;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_conversation_id is null then
    raise exception 'conversation_required' using errcode = '22023';
  end if;

  select * into v_conversation
  from public.conversations c
  where c.id = p_conversation_id
    and c.context_type <> 'legacy'
    and c.status = 'active';

  if v_conversation.id is null then
    raise exception 'conversation_not_found_or_access_denied' using errcode = '42501';
  end if;

  if v_actor = v_conversation.participant1_id then
    v_actor_role := v_conversation.participant1_role;
    v_recipient := v_conversation.participant2_id;
  elsif v_actor = v_conversation.participant2_id then
    v_actor_role := v_conversation.participant2_role;
    v_recipient := v_conversation.participant1_id;
  else
    raise exception 'conversation_not_found_or_access_denied' using errcode = '42501';
  end if;

  if not app_private.store_chat_role_is_active(v_actor, v_actor_role) then
    raise exception 'conversation_sender_capability_inactive' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.message_key_envelopes k
    where k.conversation_id = p_conversation_id
  ) then
    raise exception 'conversation_key_not_initialized' using errcode = '55000';
  end if;

  if p_message_type <> 'text'
     or p_encryption_version <> 'msg-aes-256-gcm-v1'
     or p_ciphertext is null
     or char_length(p_ciphertext) < 24
     or char_length(p_ciphertext) > 20000
     or p_ciphertext !~ '^[A-Za-z0-9+/]+={0,2}$'
     or p_iv is null
     or char_length(p_iv) < 16
     or char_length(p_iv) > 64
     or p_iv !~ '^[A-Za-z0-9+/]+={0,2}$' then
    raise exception 'invalid_encrypted_message' using errcode = '22023';
  end if;

  select count(*) into v_count
  from public.messages m
  where m.sender_id = v_actor
    and m.created_at >= now() - interval '1 minute';
  if v_count >= 60 then
    raise exception 'message_rate_limited' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.messages m
  where m.sender_id = v_actor
    and m.created_at >= now() - interval '24 hours';
  if v_count >= 2000 then
    raise exception 'message_rate_limited' using errcode = 'P0001';
  end if;

  v_order_id := case
    when v_conversation.context_type = 'order' then v_conversation.context_id
    else null
  end;

  insert into public.messages(
    sender_id, recipient_id, content, message_type, order_id,
    is_encrypted, encryption_iv, conversation_key_id, conversation_id,
    encryption_version, is_read, read_at, created_at, updated_at
  ) values (
    v_actor, v_recipient, p_ciphertext, 'text', v_order_id,
    true, p_iv, null, p_conversation_id,
    p_encryption_version, false, null, now(), now()
  ) returning id into v_message_id;

  update public.conversations
  set last_message_at = now(), updated_at = now()
  where id = p_conversation_id;

  insert into public.notifications(
    user_id, type, title, message, read, action_url, metadata, created_at, updated_at
  ) values (
    v_recipient,
    'message',
    'New message',
    'You have a new marketplace message.',
    false,
    '/dashboard/messages?conversation=' || p_conversation_id::text,
    jsonb_build_object(
      'conversation_id', p_conversation_id,
      'message_id', v_message_id,
      'context_type', v_conversation.context_type
    ),
    now(), now()
  );

  return v_message_id;
end;
$$;

revoke all on function public.send_store_message(uuid,text,text,text,text)
  from public, anon;
grant execute on function public.send_store_message(uuid,text,text,text,text)
  to authenticated, service_role;

create or replace function public.mark_store_conversation_read(
  p_conversation_id uuid
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_count integer;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and (
        c.participant1_id = v_actor
        or c.participant2_id = v_actor
        or (c.context_type = 'legacy' and v_actor = any(c.participants))
      )
  ) then
    raise exception 'conversation_not_found_or_access_denied' using errcode = '42501';
  end if;

  update public.messages
  set read_at = now(), is_read = true, updated_at = now()
  where conversation_id = p_conversation_id
    and recipient_id = v_actor
    and read_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_store_conversation_read(uuid) from public, anon;
grant execute on function public.mark_store_conversation_read(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS and least-privilege grants. Authenticated users may read only their own
-- canonical/legacy conversations and messages. All writes use reviewed RPCs.
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;
drop policy if exists conversations_participant_insert on public.conversations;
drop policy if exists conversations_participant_select on public.conversations;
create policy conversations_participant_select
on public.conversations
for select to authenticated
using (
  participant1_id = (select auth.uid())
  or participant2_id = (select auth.uid())
  or (context_type = 'legacy' and (select auth.uid()) = any(participants))
);

alter table public.messages enable row level security;
drop policy if exists messages_participant_insert on public.messages;
drop policy if exists messages_participant_select on public.messages;
create policy messages_participant_select
on public.messages
for select to authenticated
using (
  (
    conversation_id is not null
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (
          c.participant1_id = (select auth.uid())
          or c.participant2_id = (select auth.uid())
          or (c.context_type = 'legacy' and (select auth.uid()) = any(c.participants))
        )
    )
  )
  or (
    conversation_id is null
    and (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()))
  )
);

alter table public.message_attachments enable row level security;
drop policy if exists message_attachments_participant_select on public.message_attachments;
create policy message_attachments_participant_select
on public.message_attachments
for select to authenticated
using (
  exists (
    select 1 from public.messages m
    where m.id = message_attachments.message_id
      and (
        m.sender_id = (select auth.uid())
        or m.recipient_id = (select auth.uid())
      )
  )
);

revoke all on public.conversations from anon, authenticated;
grant select on public.conversations to authenticated;

revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;

-- Legacy raw conversation keys must never be browser-readable even while the
-- compatibility table remains during the expand/switch/contract rollout.
revoke all on public.conversation_keys from anon, authenticated;
grant all on public.conversation_keys to service_role;

revoke all on public.message_attachments from anon, authenticated;
grant select on public.message_attachments to authenticated;
grant all on public.conversations, public.messages, public.message_attachments to service_role;

commit;
