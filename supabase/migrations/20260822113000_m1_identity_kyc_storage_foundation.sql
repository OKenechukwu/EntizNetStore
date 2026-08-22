-- M1: canonical multi-capability identity, KYC metadata access, and storage foundations.
-- Buyer is the baseline marketplace capability. Seller and Business/BSM are
-- additive capabilities represented by profile-row presence; no permanent
-- single-role field is introduced.

begin;

create table if not exists public.profiles_business (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  legal_name text,
  business_kind text not null default 'brand',
  description text,
  website text,
  country text,
  logo_url text,
  banner_url text,
  verification_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_business_kind_check check (
    business_kind = any (array['brand','supplier','manufacturer','distributor','wholesaler','retailer','other']::text[])
  ),
  constraint profiles_business_verification_status_check check (
    verification_status = any (array['pending','under_review','verified','rejected','suspended']::text[])
  )
);

alter table public.profiles_business enable row level security;

drop policy if exists profiles_business_authenticated_select on public.profiles_business;
create policy profiles_business_authenticated_select
  on public.profiles_business
  for select
  to authenticated
  using (id = (select auth.uid()) or verification_status = 'verified');

drop policy if exists profiles_business_anon_select_verified on public.profiles_business;
create policy profiles_business_anon_select_verified
  on public.profiles_business
  for select
  to anon
  using (verification_status = 'verified');

revoke all on table public.profiles_business from anon, authenticated;
grant select on table public.profiles_business to anon, authenticated;
grant all on table public.profiles_business to service_role;

-- Seller verification is a lifecycle, not a boolean. Preserve existing values
-- while allowing the in-review and suspension states needed by M1.
alter table public.profiles_seller
  drop constraint if exists profiles_seller_verification_status_check;
alter table public.profiles_seller
  add constraint profiles_seller_verification_status_check check (
    verification_status = any (array['pending','under_review','verified','rejected','suspended']::text[])
  );

-- KYC request state supports an explicit request-for-information state.
alter table public.kyc_verification_requests
  drop constraint if exists kyc_verification_requests_verification_status_check;
alter table public.kyc_verification_requests
  add constraint kyc_verification_requests_verification_status_check check (
    verification_status = any (array['pending','incomplete','under_review','needs_information','approved','rejected']::text[])
  );

-- KYC metadata is private to its seller. Mutations remain server/service-role
-- only so clients cannot self-approve, rewrite reviewer fields, or spoof paths.
alter table public.kyc_documents enable row level security;
alter table public.kyc_verification_requests enable row level security;

drop policy if exists kyc_documents_select_own on public.kyc_documents;
create policy kyc_documents_select_own
  on public.kyc_documents
  for select
  to authenticated
  using (seller_id = (select auth.uid()));

drop policy if exists kyc_verification_requests_select_own on public.kyc_verification_requests;
create policy kyc_verification_requests_select_own
  on public.kyc_verification_requests
  for select
  to authenticated
  using (seller_id = (select auth.uid()));

revoke all on table public.kyc_documents from anon, authenticated;
revoke all on table public.kyc_verification_requests from anon, authenticated;
grant select on table public.kyc_documents to authenticated;
grant select on table public.kyc_verification_requests to authenticated;
grant all on table public.kyc_documents to service_role;
grant all on table public.kyc_verification_requests to service_role;

-- Attachment metadata is visible only to the sender/recipient of its message.
-- Upload/registration remains server-controlled.
alter table public.message_attachments enable row level security;

drop policy if exists message_attachments_participant_select on public.message_attachments;
create policy message_attachments_participant_select
  on public.message_attachments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.messages m
      where m.id = message_attachments.message_id
        and ((select auth.uid()) = m.sender_id or (select auth.uid()) = m.recipient_id)
    )
  );

revoke all on table public.message_attachments from anon, authenticated;
grant select on table public.message_attachments to authenticated;
grant all on table public.message_attachments to service_role;

-- Audit history is append-only through trusted server code. Browser roles have
-- no direct access to the table.
alter table public.admin_audit_logs enable row level security;
revoke all on table public.admin_audit_logs from anon, authenticated;
grant all on table public.admin_audit_logs to service_role;

create index if not exists idx_profiles_business_verification_status
  on public.profiles_business (verification_status);
create index if not exists idx_kyc_documents_seller_status
  on public.kyc_documents (seller_id, verification_status);
create index if not exists idx_kyc_requests_seller_status
  on public.kyc_verification_requests (seller_id, verification_status);
create index if not exists idx_message_attachments_message_id
  on public.message_attachments (message_id);

-- Storage is intentionally policy-minimal: private KYC and message objects are
-- accessed only through trusted signed-URL endpoints; public marketplace image
-- buckets are readable publicly but writes are created as signed uploads by the
-- authenticated server. No broad storage.objects write policy is introduced.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('kyc-documents', 'kyc-documents', false, 10485760, array['application/pdf','image/jpeg','image/jpg','image/png','image/webp']),
  ('product-media', 'product-media', true, 10485760, array['image/jpeg','image/jpg','image/png','image/webp']),
  ('seller-branding', 'seller-branding', true, 5242880, array['image/jpeg','image/jpg','image/png','image/webp']),
  ('message-attachments', 'message-attachments', false, 15728640, array['application/pdf','image/jpeg','image/jpg','image/png','image/webp'])
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
