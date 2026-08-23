-- EntizNetStore combined M3 — reviews, reports and prohibited-product trust/safety operations.
-- Reuses product_moderation_events + admin_audit_logs as canonical immutable
-- histories instead of introducing duplicate event ledgers.

begin;

-- ---------------------------------------------------------------------------
-- Verified-purchase reviews: pending by default, direct browser DML disabled.
-- ---------------------------------------------------------------------------
update public.reviews set status = 'pending' where status is null;
alter table public.reviews
  alter column status set default 'pending',
  alter column status set not null;

alter table public.reviews
  add column if not exists moderated_by uuid references auth.users(id) on delete set null,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderation_notes text;

alter table public.reviews
  add constraint reviews_moderation_notes_length_check
  check (moderation_notes is null or char_length(moderation_notes) <= 5000) not valid;
alter table public.reviews validate constraint reviews_moderation_notes_length_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reviews'::regclass
      and conname = 'reviews_order_id_fkey'
  ) then
    alter table public.reviews
      add constraint reviews_order_id_fkey
      foreign key (order_id) references public.orders(id) on delete restrict;
  end if;
end
$$;

create unique index if not exists reviews_one_per_order_product_buyer
  on public.reviews(buyer_id, order_id, product_id)
  where order_id is not null;
create index if not exists idx_reviews_status_created
  on public.reviews(status, created_at desc);
create index if not exists idx_reviews_product_status_created
  on public.reviews(product_id, status, created_at desc);
create index if not exists idx_reviews_order_id
  on public.reviews(order_id)
  where order_id is not null;
create index if not exists idx_reviews_moderated_by
  on public.reviews(moderated_by)
  where moderated_by is not null;

alter table public.reviews enable row level security;
drop policy if exists reviews_anon_approved_select on public.reviews;
drop policy if exists reviews_authenticated_select on public.reviews;
create policy reviews_anon_approved_select
on public.reviews for select to anon
using (status = 'approved');
create policy reviews_authenticated_select
on public.reviews for select to authenticated
using (status = 'approved' or buyer_id = (select auth.uid()));

grant select on public.reviews to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.reviews from anon, authenticated;
grant all on public.reviews to service_role;

create or replace function public.buyer_submit_review(
  p_order_id uuid,
  p_product_id uuid,
  p_rating integer,
  p_title text,
  p_content text,
  p_is_anonymous boolean
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_buyer uuid := auth.uid();
  v_review_id uuid;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_content text := nullif(btrim(coalesce(p_content, '')), '');
begin
  if v_buyer is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not public.marketplace_capability_is_active(v_buyer, 'buyer') then
    raise exception 'active_buyer_capability_required' using errcode = '42501';
  end if;
  if p_order_id is null or p_product_id is null then
    raise exception 'review_order_and_product_required' using errcode = '22023';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'invalid_review_rating' using errcode = '22023';
  end if;
  if v_title is not null and char_length(v_title) > 200 then
    raise exception 'review_title_too_long' using errcode = '22023';
  end if;
  if v_content is not null and char_length(v_content) > 5000 then
    raise exception 'review_content_too_long' using errcode = '22023';
  end if;
  if v_title is null and v_content is null then
    raise exception 'review_text_required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.id = p_order_id
      and o.buyer_id = v_buyer
      and o.status = 'delivered'
      and o.payment_status in ('paid','partially_refunded','refunded')
      and oi.product_id = p_product_id
  ) then
    raise exception 'verified_delivered_purchase_required' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.reviews r
    where r.buyer_id = v_buyer
      and r.order_id = p_order_id
      and r.product_id = p_product_id
  ) then
    raise exception 'review_already_submitted_for_order_product' using errcode = '23505';
  end if;

  insert into public.reviews(
    product_id, buyer_id, order_id, rating, title, content,
    is_verified_purchase, is_anonymous, status, created_at, updated_at
  ) values (
    p_product_id, v_buyer, p_order_id, p_rating, v_title, v_content,
    true, coalesce(p_is_anonymous, false), 'pending', now(), now()
  ) returning id into v_review_id;

  return v_review_id;
end;
$$;

revoke all on function public.buyer_submit_review(uuid,uuid,integer,text,text,boolean)
  from public, anon;
grant execute on function public.buyer_submit_review(uuid,uuid,integer,text,text,boolean)
  to authenticated, service_role;

create or replace function public.admin_moderate_review(
  p_admin_id uuid,
  p_review_id uuid,
  p_decision text,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_before public.reviews%rowtype;
begin
  if p_admin_id is null or not exists (
    select 1 from auth.users u
    where u.id = p_admin_id and u.raw_app_meta_data->>'role' = 'admin'
  ) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;
  if v_decision not in ('approved','rejected') then
    raise exception 'invalid_review_moderation_decision' using errcode = '22023';
  end if;
  if char_length(coalesce(v_notes, '')) > 5000 then
    raise exception 'review_moderation_notes_too_long' using errcode = '22023';
  end if;
  if v_decision = 'rejected' and v_notes is null then
    raise exception 'review_rejection_notes_required' using errcode = '22023';
  end if;

  select * into v_before from public.reviews where id = p_review_id for update;
  if not found then
    raise exception 'review_not_found' using errcode = '22023';
  end if;
  if v_before.status = v_decision and coalesce(v_before.moderation_notes, '') = coalesce(v_notes, '') then
    return;
  end if;

  update public.reviews
  set status = v_decision,
      moderation_notes = v_notes,
      moderated_by = p_admin_id,
      moderated_at = now(),
      updated_at = now()
  where id = p_review_id;

  insert into public.admin_audit_logs(
    admin_id, action, target_type, target_id, metadata, timestamp, created_at
  ) values (
    p_admin_id,
    case when v_decision = 'approved' then 'review_approved' else 'review_rejected' end,
    'review', p_review_id::text,
    jsonb_build_object(
      'old_status', v_before.status,
      'new_status', v_decision,
      'notes', v_notes,
      'product_id', v_before.product_id,
      'buyer_id', v_before.buyer_id,
      'order_id', v_before.order_id
    ),
    now(), now()
  );
end;
$$;

revoke all on function public.admin_moderate_review(uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.admin_moderate_review(uuid,uuid,text,text) to service_role;

-- ---------------------------------------------------------------------------
-- User reports. Current state is mutable only through trusted RPCs; Admin
-- transitions are preserved in the canonical immutable admin_audit_logs ledger.
-- ---------------------------------------------------------------------------
create table public.marketplace_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete restrict,
  subject_type text not null check (subject_type in (
    'product','review','seller','buyer','order','dispute','content'
  )),
  subject_id uuid not null,
  reason_code text not null check (reason_code in (
    'prohibited_product','counterfeit','fraud','spam','abuse','unsafe_content','policy_violation','other'
  )),
  details text,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','in_review','resolved','dismissed')),
  assigned_admin_id uuid references auth.users(id) on delete set null,
  resolution_notes text,
  resolution_metadata jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_reports_details_length_check check (details is null or char_length(details) <= 5000),
  constraint marketplace_reports_resolution_length_check check (resolution_notes is null or char_length(resolution_notes) <= 10000)
);

create unique index marketplace_reports_one_active_per_reporter_subject
  on public.marketplace_reports(reporter_user_id, subject_type, subject_id)
  where status in ('open','in_review');
create index idx_marketplace_reports_status_priority_created
  on public.marketplace_reports(status, priority, created_at desc);
create index idx_marketplace_reports_subject_created
  on public.marketplace_reports(subject_type, subject_id, created_at desc);
create index idx_marketplace_reports_reporter_created
  on public.marketplace_reports(reporter_user_id, created_at desc);
create index idx_marketplace_reports_assigned_admin
  on public.marketplace_reports(assigned_admin_id, status, created_at desc)
  where assigned_admin_id is not null;

alter table public.marketplace_reports enable row level security;
create policy marketplace_reports_select_own
on public.marketplace_reports for select to authenticated
using (reporter_user_id = (select auth.uid()));
revoke all on public.marketplace_reports from public, anon, authenticated;
grant select on public.marketplace_reports to authenticated;
grant all on public.marketplace_reports to service_role;

create or replace function public.submit_marketplace_report(
  p_subject_type text,
  p_subject_id uuid,
  p_reason_code text,
  p_details text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_subject text := lower(btrim(coalesce(p_subject_type, '')));
  v_reason text := lower(btrim(coalesce(p_reason_code, '')));
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
  v_report_id uuid;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_subject_id is null then
    raise exception 'report_subject_required' using errcode = '22023';
  end if;
  if v_subject not in ('product','review','seller','buyer','order','dispute','content') then
    raise exception 'invalid_report_subject_type' using errcode = '22023';
  end if;
  if v_reason not in ('prohibited_product','counterfeit','fraud','spam','abuse','unsafe_content','policy_violation','other') then
    raise exception 'invalid_report_reason' using errcode = '22023';
  end if;
  if char_length(coalesce(v_details, '')) > 5000 then
    raise exception 'report_details_too_long' using errcode = '22023';
  end if;
  if v_reason = 'other' and v_details is null then
    raise exception 'report_details_required_for_other_reason' using errcode = '22023';
  end if;

  if v_subject = 'product' and not exists (select 1 from public.products p where p.id = p_subject_id) then
    raise exception 'report_subject_not_found' using errcode = '22023';
  elsif v_subject = 'review' and not exists (select 1 from public.reviews r where r.id = p_subject_id) then
    raise exception 'report_subject_not_found' using errcode = '22023';
  elsif v_subject = 'seller' and not exists (select 1 from public.profiles_seller s where s.id = p_subject_id) then
    raise exception 'report_subject_not_found' using errcode = '22023';
  elsif v_subject = 'buyer' and not exists (select 1 from public.profiles_buyer b where b.id = p_subject_id) then
    raise exception 'report_subject_not_found' using errcode = '22023';
  elsif v_subject = 'content' and not exists (select 1 from public.content_pages c where c.id = p_subject_id) then
    raise exception 'report_subject_not_found' using errcode = '22023';
  elsif v_subject = 'order' and not exists (
    select 1 from public.orders o
    where o.id = p_subject_id and (o.buyer_id = v_actor or o.seller_id = v_actor)
  ) then
    raise exception 'report_order_participant_required' using errcode = '42501';
  elsif v_subject = 'dispute' and not exists (
    select 1
    from public.order_disputes d
    join public.orders o on o.id = d.order_id
    where d.id = p_subject_id and (o.buyer_id = v_actor or o.seller_id = v_actor)
  ) then
    raise exception 'report_dispute_participant_required' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.marketplace_reports r
    where r.reporter_user_id = v_actor
      and r.subject_type = v_subject
      and r.subject_id = p_subject_id
      and r.status in ('open','in_review')
  ) then
    raise exception 'active_report_already_exists' using errcode = '23505';
  end if;

  insert into public.marketplace_reports(
    reporter_user_id, subject_type, subject_id, reason_code, details
  ) values (
    v_actor, v_subject, p_subject_id, v_reason, v_details
  ) returning id into v_report_id;

  return v_report_id;
end;
$$;

revoke all on function public.submit_marketplace_report(text,uuid,text,text) from public, anon;
grant execute on function public.submit_marketplace_report(text,uuid,text,text)
  to authenticated, service_role;

create or replace function public.admin_transition_marketplace_report(
  p_admin_id uuid,
  p_report_id uuid,
  p_status text,
  p_priority text,
  p_resolution_notes text,
  p_resolution_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_report public.marketplace_reports%rowtype;
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_priority text := lower(btrim(coalesce(p_priority, 'normal')));
  v_notes text := nullif(btrim(coalesce(p_resolution_notes, '')), '');
begin
  if p_admin_id is null or not exists (
    select 1 from auth.users u
    where u.id = p_admin_id and u.raw_app_meta_data->>'role' = 'admin'
  ) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;
  if v_status not in ('in_review','resolved','dismissed') then
    raise exception 'invalid_report_status' using errcode = '22023';
  end if;
  if v_priority not in ('low','normal','high','urgent') then
    raise exception 'invalid_report_priority' using errcode = '22023';
  end if;
  if char_length(coalesce(v_notes, '')) > 10000 then
    raise exception 'report_resolution_notes_too_long' using errcode = '22023';
  end if;
  if v_status in ('resolved','dismissed') and v_notes is null then
    raise exception 'report_resolution_notes_required' using errcode = '22023';
  end if;

  select * into v_report from public.marketplace_reports where id = p_report_id for update;
  if not found then
    raise exception 'marketplace_report_not_found' using errcode = '22023';
  end if;
  if v_report.status in ('resolved','dismissed') then
    raise exception 'terminal_marketplace_report' using errcode = '22023';
  end if;

  update public.marketplace_reports
  set status = v_status,
      priority = v_priority,
      assigned_admin_id = p_admin_id,
      resolution_notes = case when v_status in ('resolved','dismissed') then v_notes else resolution_notes end,
      resolution_metadata = coalesce(p_resolution_metadata, '{}'::jsonb),
      resolved_at = case when v_status in ('resolved','dismissed') then now() else null end,
      updated_at = now()
  where id = p_report_id;

  insert into public.admin_audit_logs(
    admin_id, action, target_type, target_id, metadata, timestamp, created_at
  ) values (
    p_admin_id,
    case v_status when 'in_review' then 'marketplace_report_taken_for_review'
                  when 'resolved' then 'marketplace_report_resolved'
                  else 'marketplace_report_dismissed' end,
    'marketplace_report', p_report_id::text,
    jsonb_build_object(
      'subject_type', v_report.subject_type,
      'subject_id', v_report.subject_id,
      'old_status', v_report.status,
      'new_status', v_status,
      'priority', v_priority,
      'resolution_notes', v_notes,
      'resolution_metadata', coalesce(p_resolution_metadata, '{}'::jsonb)
    ),
    now(), now()
  );
end;
$$;

revoke all on function public.admin_transition_marketplace_report(uuid,uuid,text,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_transition_marketplace_report(uuid,uuid,text,text,text,jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- Prohibited-product rules. Enforcement reuses product_moderation_events and
-- admin_audit_logs; products are hidden/rejected without deleting evidence.
-- ---------------------------------------------------------------------------
create table public.prohibited_product_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  severity text not null default 'high' check (severity in ('low','medium','high','critical')),
  default_action text not null default 'reject' check (default_action in ('warn','unpublish','reject')),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prohibited_product_rules_code_check check (code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$' and char_length(code) <= 100),
  constraint prohibited_product_rules_title_check check (char_length(title) between 1 and 200),
  constraint prohibited_product_rules_description_check check (description is null or char_length(description) <= 10000)
);
create index idx_prohibited_product_rules_active_severity
  on public.prohibited_product_rules(is_active, severity, code);

alter table public.prohibited_product_rules enable row level security;
revoke all on public.prohibited_product_rules from public, anon, authenticated;
grant all on public.prohibited_product_rules to service_role;

create or replace function public.admin_save_prohibited_product_rule(
  p_admin_id uuid,
  p_rule_id uuid,
  p_code text,
  p_title text,
  p_description text,
  p_severity text,
  p_default_action text,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_id uuid := p_rule_id;
  v_code text := lower(btrim(coalesce(p_code, '')));
  v_title text := btrim(coalesce(p_title, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_severity text := lower(btrim(coalesce(p_severity, 'high')));
  v_action text := lower(btrim(coalesce(p_default_action, 'reject')));
  v_before jsonb;
  v_audit_action text;
begin
  if p_admin_id is null or not exists (
    select 1 from auth.users u
    where u.id = p_admin_id and u.raw_app_meta_data->>'role' = 'admin'
  ) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;
  if v_code = '' or v_code !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$' or char_length(v_code) > 100 then
    raise exception 'invalid_prohibited_rule_code' using errcode = '22023';
  end if;
  if v_title = '' or char_length(v_title) > 200 then
    raise exception 'invalid_prohibited_rule_title' using errcode = '22023';
  end if;
  if char_length(coalesce(v_description, '')) > 10000 then
    raise exception 'prohibited_rule_description_too_long' using errcode = '22023';
  end if;
  if v_severity not in ('low','medium','high','critical') then
    raise exception 'invalid_prohibited_rule_severity' using errcode = '22023';
  end if;
  if v_action not in ('warn','unpublish','reject') then
    raise exception 'invalid_prohibited_rule_action' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.prohibited_product_rules r
    where r.code = v_code and (p_rule_id is null or r.id <> p_rule_id)
  ) then
    raise exception 'prohibited_rule_code_already_exists' using errcode = '23505';
  end if;

  if p_rule_id is null then
    insert into public.prohibited_product_rules(
      code, title, description, severity, default_action, is_active, created_by, updated_by
    ) values (
      v_code, v_title, v_description, v_severity, v_action, coalesce(p_is_active, true), p_admin_id, p_admin_id
    ) returning id into v_id;
    v_audit_action := 'prohibited_product_rule_created';
  else
    select to_jsonb(r) into v_before from public.prohibited_product_rules r where r.id = p_rule_id for update;
    if v_before is null then
      raise exception 'prohibited_product_rule_not_found' using errcode = '22023';
    end if;
    update public.prohibited_product_rules
    set code = v_code,
        title = v_title,
        description = v_description,
        severity = v_severity,
        default_action = v_action,
        is_active = coalesce(p_is_active, true),
        updated_by = p_admin_id,
        updated_at = now()
    where id = p_rule_id;
    v_audit_action := 'prohibited_product_rule_updated';
  end if;

  insert into public.admin_audit_logs(
    admin_id, action, target_type, target_id, metadata, timestamp, created_at
  ) values (
    p_admin_id, v_audit_action, 'prohibited_product_rule', v_id::text,
    jsonb_build_object(
      'before', v_before,
      'after', (select to_jsonb(r) from public.prohibited_product_rules r where r.id = v_id)
    ),
    now(), now()
  );

  return v_id;
end;
$$;

revoke all on function public.admin_save_prohibited_product_rule(uuid,uuid,text,text,text,text,text,boolean)
  from public, anon, authenticated;
grant execute on function public.admin_save_prohibited_product_rule(uuid,uuid,text,text,text,text,text,boolean)
  to service_role;

create or replace function public.admin_enforce_prohibited_product(
  p_admin_id uuid,
  p_product_id uuid,
  p_rule_id uuid,
  p_action text,
  p_notes text,
  p_report_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_product public.products%rowtype;
  v_rule public.prohibited_product_rules%rowtype;
  v_action text;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_report public.marketplace_reports%rowtype;
begin
  if p_admin_id is null or not exists (
    select 1 from auth.users u
    where u.id = p_admin_id and u.raw_app_meta_data->>'role' = 'admin'
  ) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'product_not_found' using errcode = '22023';
  end if;
  select * into v_rule from public.prohibited_product_rules where id = p_rule_id;
  if not found or not v_rule.is_active then
    raise exception 'active_prohibited_product_rule_required' using errcode = '22023';
  end if;

  v_action := lower(btrim(coalesce(nullif(p_action, ''), v_rule.default_action)));
  if v_action not in ('warn','unpublish','reject') then
    raise exception 'invalid_prohibited_enforcement_action' using errcode = '22023';
  end if;
  if char_length(coalesce(v_notes, '')) > 10000 then
    raise exception 'prohibited_enforcement_notes_too_long' using errcode = '22023';
  end if;
  if v_action in ('unpublish','reject') and v_notes is null then
    raise exception 'prohibited_enforcement_notes_required' using errcode = '22023';
  end if;

  if p_report_id is not null then
    select * into v_report from public.marketplace_reports where id = p_report_id for update;
    if not found or v_report.subject_type <> 'product' or v_report.subject_id <> p_product_id then
      raise exception 'matching_product_report_required' using errcode = '22023';
    end if;
    if v_report.status in ('resolved','dismissed') then
      raise exception 'terminal_marketplace_report' using errcode = '22023';
    end if;
  end if;

  if v_action = 'unpublish' then
    update public.products
    set status = 'inactive', updated_at = now()
    where id = p_product_id;
    insert into public.product_moderation_events(product_id, actor_id, actor_role, action, notes, metadata)
    values (
      p_product_id, p_admin_id, 'admin', 'unpublished', v_notes,
      jsonb_build_object('policy_rule_id', p_rule_id, 'policy_rule_code', v_rule.code, 'report_id', p_report_id, 'enforcement_action', v_action)
    );
  elsif v_action = 'reject' then
    update public.products
    set status = 'inactive',
        moderation_status = 'rejected',
        moderation_notes = v_notes,
        moderated_at = now(),
        moderated_by = p_admin_id,
        updated_at = now()
    where id = p_product_id;
    insert into public.product_moderation_events(product_id, actor_id, actor_role, action, notes, metadata)
    values (
      p_product_id, p_admin_id, 'admin', 'rejected', v_notes,
      jsonb_build_object('policy_rule_id', p_rule_id, 'policy_rule_code', v_rule.code, 'report_id', p_report_id, 'enforcement_action', v_action)
    );
  end if;

  insert into public.admin_audit_logs(
    admin_id, action, target_type, target_id, metadata, timestamp, created_at
  ) values (
    p_admin_id, 'prohibited_product_enforced', 'product', p_product_id::text,
    jsonb_build_object(
      'rule_id', p_rule_id,
      'rule_code', v_rule.code,
      'rule_severity', v_rule.severity,
      'enforcement_action', v_action,
      'notes', v_notes,
      'report_id', p_report_id,
      'old_status', v_product.status,
      'old_moderation_status', v_product.moderation_status
    ),
    now(), now()
  );

  if p_report_id is not null then
    update public.marketplace_reports
    set status = 'resolved',
        assigned_admin_id = p_admin_id,
        resolution_notes = coalesce(v_notes, 'Prohibited-product enforcement completed'),
        resolution_metadata = jsonb_build_object(
          'rule_id', p_rule_id,
          'rule_code', v_rule.code,
          'enforcement_action', v_action
        ),
        resolved_at = now(),
        updated_at = now()
    where id = p_report_id;

    insert into public.admin_audit_logs(
      admin_id, action, target_type, target_id, metadata, timestamp, created_at
    ) values (
      p_admin_id, 'marketplace_report_resolved', 'marketplace_report', p_report_id::text,
      jsonb_build_object(
        'subject_type', 'product',
        'subject_id', p_product_id,
        'resolution', 'prohibited_product_enforcement',
        'rule_id', p_rule_id,
        'enforcement_action', v_action
      ),
      now(), now()
    );
  end if;
end;
$$;

revoke all on function public.admin_enforce_prohibited_product(uuid,uuid,uuid,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.admin_enforce_prohibited_product(uuid,uuid,uuid,text,text,uuid)
  to service_role;

commit;
