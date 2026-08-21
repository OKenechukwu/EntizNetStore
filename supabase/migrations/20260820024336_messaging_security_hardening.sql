-- PostgREST grants EXECUTE to API roles explicitly. Trigger helpers must never
-- be callable as RPCs, and the read-status RPC is authenticated-only.
revoke execute on function public.touch_conversation_after_message()
  from anon, authenticated;
revoke execute on function public.mark_conversation_read(uuid) from anon;

-- Covers the conversation foreign key and primary thread-loading query.
create index idx_messages_conversation_id
  on public.messages (conversation_id);
