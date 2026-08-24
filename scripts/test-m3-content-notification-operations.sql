\set ON_ERROR_STOP on

-- Combined M3 content/notification regression suite. Disposable CI database only.
begin;

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('00000000-0000-0000-0000-000000000000','f1000000-0000-0000-0000-000000000001','authenticated','authenticated','content-admin@test.invalid','',now(),'{"role":"admin"}'::jsonb,'{}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','f2000000-0000-0000-0000-000000000002','authenticated','authenticated','content-user@test.invalid','',now(),'{}'::jsonb,'{}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','f3000000-0000-0000-0000-000000000003','authenticated','authenticated','content-other@test.invalid','',now(),'{}'::jsonb,'{}'::jsonb,now(),now());

-- Trusted mutation boundaries stay server-authoritative.
do $$
declare v_fn text;
begin
  foreach v_fn in array array[
    'public.admin_save_content_page(uuid,uuid,text,text,text,jsonb,boolean)',
    'public.admin_send_notification(uuid,uuid,text,text,text,text,jsonb)'
  ] loop
    if has_function_privilege('anon',v_fn,'EXECUTE')
       or has_function_privilege('authenticated',v_fn,'EXECUTE')
       or not has_function_privilege('service_role',v_fn,'EXECUTE') then
      raise exception 'Content/notification Admin RPC boundary failed for %', v_fn;
    end if;
  end loop;

  foreach v_fn in array array[
    'public.mark_notification_read(uuid)',
    'public.mark_all_notifications_read()'
  ] loop
    if has_function_privilege('anon',v_fn,'EXECUTE')
       or not has_function_privilege('authenticated',v_fn,'EXECUTE') then
      raise exception 'Notification owner RPC boundary failed for %', v_fn;
    end if;
  end loop;

  if has_table_privilege('authenticated','public.content_pages','INSERT')
     or has_table_privilege('authenticated','public.content_pages','UPDATE')
     or has_table_privilege('authenticated','public.notifications','INSERT')
     or has_table_privilege('authenticated','public.notifications','UPDATE') then
    raise exception 'Browser content/notification table DML remains open';
  end if;
end
$$;

set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);

select public.admin_save_content_page(
  'f1000000-0000-0000-0000-000000000001',null,'terms-of-service',
  'Terms of Service','Operational terms body','{"version":1}'::jsonb,true
) as active_page_id \gset
select set_config('m3content.active_page_id', :'active_page_id', false);

select public.admin_save_content_page(
  'f1000000-0000-0000-0000-000000000001',null,'draft-policy',
  'Draft Policy','Not public yet','{}'::jsonb,false
) as inactive_page_id \gset
select set_config('m3content.inactive_page_id', :'inactive_page_id', false);

-- A page for another marketplace brand must never leak through the EntizNetStore
-- public content policy.
insert into public.content_pages(marketplace_brand,page_key,title,content,is_active)
values ('primediscreet','other-brand-page','Other Brand','Private other brand content',true);

select public.admin_send_notification(
  'f1000000-0000-0000-0000-000000000001',
  'f2000000-0000-0000-0000-000000000002',
  'system','Account notice','Your marketplace account has an update','/account',
  '{"source":"regression"}'::jsonb
) as owned_notification_id \gset
select set_config('m3content.owned_notification_id', :'owned_notification_id', false);

select public.admin_send_notification(
  'f1000000-0000-0000-0000-000000000001',
  'f3000000-0000-0000-0000-000000000003',
  'system','Other notice','This belongs to another account','/account',
  '{}'::jsonb
) as other_notification_id \gset
select set_config('m3content.other_notification_id', :'other_notification_id', false);

-- Open-redirect shaped notification targets are rejected.
do $$
begin
  begin
    perform public.admin_send_notification(
      'f1000000-0000-0000-0000-000000000001',
      'f2000000-0000-0000-0000-000000000002',
      'system','Unsafe link','Unsafe action link','//evil.example/path','{}'::jsonb
    );
    raise exception 'Unsafe notification action URL was accepted';
  exception when sqlstate '22023' then null;
  end;
end
$$;
reset role;

-- Public content sees only active EntizNetStore pages.
set local role anon;
do $$
begin
  if (select count(*) from public.content_pages where page_key='terms-of-service') <> 1 then
    raise exception 'Active EntizNetStore content page is not publicly readable';
  end if;
  if (select count(*) from public.content_pages where page_key in ('draft-policy','other-brand-page')) <> 0 then
    raise exception 'Inactive or other-brand content leaked publicly';
  end if;
end
$$;
reset role;

-- Authenticated notification RLS exposes only the owner row.
set local role authenticated;
select set_config('request.jwt.claim.sub','f2000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"f2000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
do $$
begin
  if (select count(*) from public.notifications) <> 1 then
    raise exception 'Notification RLS exposed another account or hid owner row';
  end if;
  if (select read from public.notifications where id=current_setting('m3content.owned_notification_id')::uuid) then
    raise exception 'New notification unexpectedly starts read';
  end if;
end
$$;

select public.mark_notification_read(current_setting('m3content.owned_notification_id')::uuid);
do $$
begin
  if not (select read from public.notifications where id=current_setting('m3content.owned_notification_id')::uuid) then
    raise exception 'Owner notification was not marked read';
  end if;

  begin
    perform public.mark_notification_read(current_setting('m3content.other_notification_id')::uuid);
    raise exception 'User marked another account notification read';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- Add two more unread rows and prove mark-all is owner-scoped and counted.
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.admin_send_notification(
  'f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000002',
  'order','Order update','Order regression one','/orders','{}'::jsonb
);
select public.admin_send_notification(
  'f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000002',
  'payment','Payment update','Payment regression two','/orders','{}'::jsonb
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','f2000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"f2000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select public.mark_all_notifications_read() as marked_count \gset
select set_config('m3content.marked_count', :'marked_count', false);
do $$
begin
  if current_setting('m3content.marked_count')::integer <> 2 then
    raise exception 'Mark-all notification count was incorrect';
  end if;
  if exists (select 1 from public.notifications where coalesce(read,false)=false) then
    raise exception 'Owner still has unread notifications after mark-all';
  end if;
end
$$;
reset role;

-- Admin audit history attributes content and notification actions.
do $$
begin
  if (select count(*) from public.admin_audit_logs
      where admin_id='f1000000-0000-0000-0000-000000000001'
        and action in ('content_page_created','notification_sent')) < 5 then
    raise exception 'Content/notification Admin audit history is incomplete';
  end if;
end
$$;

rollback;
select 'M3 content and notification operations regression suite passed' as result;
