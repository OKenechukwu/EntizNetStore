-- Canonical messaging authorization.
-- Participants may discover/create their own conversations and exchange
-- messages only with another participant. Conversation timestamps are
-- maintained by the database so clients never need broad UPDATE access.

create policy conversations_participant_select on public.conversations
  for select to authenticated
  using (auth.uid() = any (participants));

create policy conversations_participant_insert on public.conversations
  for insert to authenticated
  with check (
    auth.uid() = any (participants)
    and cardinality(participants) = 2
    and participants[1] <> participants[2]
  );

create policy messages_participant_select on public.messages
  for select to authenticated
  using (
    sender_id = auth.uid()
    or recipient_id = auth.uid()
  );

create policy messages_participant_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and recipient_id <> auth.uid()
    and exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and auth.uid() = any (c.participants)
        and messages.recipient_id = any (c.participants)
    )
  );

create or replace function public.touch_conversation_after_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set last_message_at = new.created_at,
      updated_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

revoke all on function public.touch_conversation_after_message() from public;

create trigger messages_touch_conversation
after insert on public.messages
for each row execute function public.touch_conversation_after_message();

create or replace function public.mark_conversation_read(
  target_conversation_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.messages
  set is_read = true,
      read_at = coalesce(read_at, now()),
      updated_at = now()
  where conversation_id = target_conversation_id
    and recipient_id = auth.uid()
    and not is_read;
$$;

revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
