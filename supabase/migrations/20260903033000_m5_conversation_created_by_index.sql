-- EntizNetStore M5 — close the post-DDL foreign-key indexing gap discovered by
-- the hosted Supabase performance advisor before Store Chat application code is
-- released. Keep the creator lookup/delete path covered as conversation volume
-- grows.

begin;

create index if not exists idx_conversations_created_by
  on public.conversations(created_by);

commit;
