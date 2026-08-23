-- EntizNetStore combined M3 — operational content publishing and notifications.
-- No new tables: hardens the existing canonical content_pages + notifications.

begin;

create index if not exists idx_content_pages_brand_active_key
  on public.content_pages(marketplace_brand, is_active, page_key);
create index if not exists idx_notifications_user_unread_created
  on public.notifications(user_id, read, created_at desc);

alter table public.content_pages enable row level security;
drop policy if exists content_pages_public_active_select on public.content_pages;
create policy content_pages_public_active_select
on public.content_pages
for select to anon, authenticated
using (marketplace_brand = 'entiznetstore' and coalesce(is_active, true));

grant select on public.content_pages to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.content_pages from anon, authenticated;
grant all on public.content_pages to service_role;

alter table public.notifications enable row level security;
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications
for select to authenticated
using (user_id = (select auth.uid()));

grant select on public.notifications to authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.notifications from anon, authenticated;
grant all on public.notifications to service_role;

create or replace function public.mark_notification_read(
  p_notification_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_notification_id is null then
    raise exception 'notification_id_required' using errcode = '22023';
  end if;

  update public.notifications
  set read = true,
      updated_at = now()
  where id = p_notification_id
    and user_id = v_user;

  if not found then
    raise exception 'notification_not_found_or_not_owned' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  update public.notifications
  set read = true,
      updated_at = now()
  where user_id = v_user
    and coalesce(read, false) = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated, service_role;
revoke all on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_all_notifications_read() to authenticated, service_role;

create or replace function public.admin_save_content_page(
  p_admin_id uuid,
  p_page_id uuid,
  p_page_key text,
  p_title text,
  p_content text,
  p_metadata jsonb,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_id uuid := p_page_id;
  v_key text := lower(btrim(coalesce(p_page_key, '')));
  v_title text := btrim(coalesce(p_title, ''));
  v_content text := nullif(btrim(coalesce(p_content, '')), '');
  v_before jsonb;
  v_action text;
begin
  if p_admin_id is null or not exists (
    select 1 from auth.users u
    where u.id = p_admin_id and u.raw_app_meta_data->>'role' = 'admin'
  ) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;
  if v_key = '' or v_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_key) > 120 then
    raise exception 'invalid_content_page_key' using errcode = '22023';
  end if;
  if v_title = '' or char_length(v_title) > 240 then
    raise exception 'invalid_content_page_title' using errcode = '22023';
  end if;
  if char_length(coalesce(v_content, '')) > 200000 then
    raise exception 'content_page_too_large' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.content_pages c
    where c.marketplace_brand = 'entiznetstore'
      and c.page_key = v_key
      and (p_page_id is null or c.id <> p_page_id)
  ) then
    raise exception 'content_page_key_already_exists' using errcode = '23505';
  end if;

  if p_page_id is null then
    insert into public.content_pages(
      marketplace_brand, page_key, title, content, metadata, is_active, created_at, updated_at
    ) values (
      'entiznetstore', v_key, v_title, v_content, coalesce(p_metadata, '{}'::jsonb),
      coalesce(p_is_active, true), now(), now()
    ) returning id into v_id;
    v_action := 'content_page_created';
  else
    select to_jsonb(c) into v_before
    from public.content_pages c
    where c.id = p_page_id and c.marketplace_brand = 'entiznetstore'
    for update;
    if v_before is null then
      raise exception 'content_page_not_found' using errcode = '22023';
    end if;

    update public.content_pages
    set page_key = v_key,
        title = v_title,
        content = v_content,
        metadata = coalesce(p_metadata, '{}'::jsonb),
        is_active = coalesce(p_is_active, true),
        updated_at = now()
    where id = p_page_id;
    v_action := 'content_page_updated';
  end if;

  insert into public.admin_audit_logs(
    admin_id, action, target_type, target_id, metadata, timestamp, created_at
  ) values (
    p_admin_id, v_action, 'content_page', v_id::text,
    jsonb_build_object(
      'before', v_before,
      'after', (select to_jsonb(c) from public.content_pages c where c.id = v_id)
    ),
    now(), now()
  );

  return v_id;
end;
$$;

revoke all on function public.admin_save_content_page(uuid,uuid,text,text,text,jsonb,boolean)
  from public, anon, authenticated;
grant execute on function public.admin_save_content_page(uuid,uuid,text,text,text,jsonb,boolean)
  to service_role;

create or replace function public.admin_send_notification(
  p_admin_id uuid,
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_action_url text,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_id uuid;
  v_type text := lower(btrim(coalesce(p_type, '')));
  v_title text := btrim(coalesce(p_title, ''));
  v_message text := btrim(coalesce(p_message, ''));
  v_action_url text := nullif(btrim(coalesce(p_action_url, '')), '');
begin
  if p_admin_id is null or not exists (
    select 1 from auth.users u
    where u.id = p_admin_id and u.raw_app_meta_data->>'role' = 'admin'
  ) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;
  if p_user_id is null or not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'notification_target_user_not_found' using errcode = '22023';
  end if;
  if v_type not in ('message','order','promo','system','payment','shipping') then
    raise exception 'invalid_notification_type' using errcode = '22023';
  end if;
  if v_title = '' or char_length(v_title) > 240 then
    raise exception 'invalid_notification_title' using errcode = '22023';
  end if;
  if v_message = '' or char_length(v_message) > 10000 then
    raise exception 'invalid_notification_message' using errcode = '22023';
  end if;
  if v_action_url is not null and (
    char_length(v_action_url) > 1000
    or v_action_url !~ '^/[^\\]*$'
    or v_action_url ~ '^//'
  ) then
    raise exception 'invalid_notification_action_url' using errcode = '22023';
  end if;

  insert into public.notifications(
    user_id, type, title, message, read, action_url, metadata, created_at, updated_at
  ) values (
    p_user_id, v_type, v_title, v_message, false, v_action_url,
    coalesce(p_metadata, '{}'::jsonb), now(), now()
  ) returning id into v_id;

  insert into public.admin_audit_logs(
    admin_id, action, target_type, target_id, metadata, timestamp, created_at
  ) values (
    p_admin_id, 'notification_sent', 'notification', v_id::text,
    jsonb_build_object(
      'target_user_id', p_user_id,
      'type', v_type,
      'title', v_title,
      'action_url', v_action_url
    ),
    now(), now()
  );

  return v_id;
end;
$$;

revoke all on function public.admin_send_notification(uuid,uuid,text,text,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_send_notification(uuid,uuid,text,text,text,text,jsonb)
  to service_role;

commit;
