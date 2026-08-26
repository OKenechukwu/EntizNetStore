-- P0 upload-safety foundation.
-- Untrusted bytes must land in a private quarantine bucket first. Promotion into
-- KYC, messaging, branding or public product-media storage is a trusted-server
-- operation performed only after byte validation and malware-scan approval.

begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'upload-quarantine',
  'upload-quarantine',
  false,
  15728640,
  array[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.upload_scan_jobs (
  id uuid primary key,
  actor_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null,
  quarantine_path text not null unique,
  destination_bucket text not null,
  destination_path text not null,
  declared_mime text not null,
  verified_mime text,
  byte_size bigint,
  sha256 text,
  status text not null default 'pending_upload',
  scanner text,
  scanner_version text,
  scanner_result_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  scanned_at timestamptz,
  promoted_at timestamptz,
  registered_at timestamptz,
  registered_record_id uuid,
  constraint upload_scan_jobs_purpose_check
    check (purpose in ('product_media', 'kyc', 'seller_branding', 'message_attachment')),
  constraint upload_scan_jobs_status_check
    check (status in ('pending_upload', 'scanning', 'clean', 'registering', 'registered', 'blocked', 'failed')),
  constraint upload_scan_jobs_quarantine_path_check
    check (
      char_length(quarantine_path) between 8 and 500
      and quarantine_path !~ '[[:cntrl:]]'
      and quarantine_path !~ '(^|/)\.\.(/|$)'
      and position('\\' in quarantine_path) = 0
      and quarantine_path like actor_id::text || '/%'
    ),
  constraint upload_scan_jobs_destination_bucket_check
    check (destination_bucket in ('product-media', 'kyc-documents', 'seller-branding', 'message-attachments')),
  constraint upload_scan_jobs_purpose_destination_check
    check (
      (purpose = 'product_media' and destination_bucket = 'product-media')
      or (purpose = 'kyc' and destination_bucket = 'kyc-documents')
      or (purpose = 'seller_branding' and destination_bucket = 'seller-branding')
      or (purpose = 'message_attachment' and destination_bucket = 'message-attachments')
    ),
  constraint upload_scan_jobs_destination_path_check
    check (
      char_length(destination_path) between 8 and 500
      and destination_path !~ '[[:cntrl:]]'
      and destination_path !~ '(^|/)\.\.(/|$)'
      and position('\\' in destination_path) = 0
      and destination_path like actor_id::text || '/%'
    ),
  constraint upload_scan_jobs_destination_unique
    unique (destination_bucket, destination_path),
  constraint upload_scan_jobs_declared_mime_check
    check (declared_mime in ('application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp')),
  constraint upload_scan_jobs_verified_mime_check
    check (verified_mime is null or verified_mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  constraint upload_scan_jobs_byte_size_check
    check (byte_size is null or (byte_size > 0 and byte_size <= 15728640)),
  constraint upload_scan_jobs_sha256_check
    check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  constraint upload_scan_jobs_scanner_check
    check (scanner is null or (char_length(scanner) between 1 and 80 and scanner !~ '[[:cntrl:]]')),
  constraint upload_scan_jobs_scanner_version_check
    check (scanner_version is null or (char_length(scanner_version) between 1 and 80 and scanner_version !~ '[[:cntrl:]]')),
  constraint upload_scan_jobs_result_code_check
    check (scanner_result_code is null or (char_length(scanner_result_code) between 1 and 120 and scanner_result_code !~ '[[:cntrl:]]')),
  constraint upload_scan_jobs_clean_evidence_check
    check (
      status not in ('clean', 'registering', 'registered')
      or (
        verified_mime is not null
        and byte_size is not null
        and sha256 is not null
        and scanner is not null
        and scanner_result_code is not null
        and scanned_at is not null
        and promoted_at is not null
      )
    ),
  constraint upload_scan_jobs_registration_state_check
    check (
      status not in ('registering', 'registered')
      or purpose = 'kyc'
    ),
  constraint upload_scan_jobs_registered_evidence_check
    check (
      status <> 'registered'
      or (registered_at is not null and registered_record_id is not null)
    ),
  constraint upload_scan_jobs_registration_metadata_check
    check (
      (registered_at is null and registered_record_id is null)
      or status = 'registered'
    )
);

alter table public.upload_scan_jobs enable row level security;
revoke all on table public.upload_scan_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.upload_scan_jobs to service_role;

create index if not exists idx_upload_scan_jobs_actor_created
  on public.upload_scan_jobs(actor_id, created_at desc);
create index if not exists idx_upload_scan_jobs_status_created
  on public.upload_scan_jobs(status, created_at desc);
create index if not exists idx_upload_scan_jobs_purpose_created
  on public.upload_scan_jobs(purpose, created_at desc);

alter table public.kyc_documents
  add column if not exists upload_scan_job_id uuid;

alter table public.kyc_documents
  drop constraint if exists kyc_documents_upload_scan_job_id_fkey;
alter table public.kyc_documents
  add constraint kyc_documents_upload_scan_job_id_fkey
  foreign key (upload_scan_job_id)
  references public.upload_scan_jobs(id)
  on delete restrict;

create unique index if not exists idx_kyc_documents_upload_scan_job_id
  on public.kyc_documents(upload_scan_job_id)
  where upload_scan_job_id is not null;

commit;
