-- ตรวจว่า migration ตัวไหนรันแล้วบ้าง (อ่านอย่างเดียว ไม่แก้ข้อมูล)
-- วางทั้งไฟล์ใน Supabase SQL Editor แล้วกด Run — ทุกแถวควรเป็น true
select '0001 schema'            as migration, to_regclass('public.events') is not null as applied
union all select '0002 auth/RLS',  to_regclass('public.profiles') is not null
union all select '0003 monitor feed', to_regprocedure('public.get_monitor_team()') is not null
union all select '0005 accounts',  exists (select 1 from pg_proc where proname = 'get_accounts')
union all select '0006 notifications', exists (select 1 from pg_proc where proname = 'enqueue_event_notifications')
union all select '0007 username login', exists (select 1 from pg_proc where proname = 'get_login_email')
union all select '0008 monitor assignees',
  coalesce(pg_get_function_result(to_regprocedure('public.get_monitor_events()')) like '%assignees text[]%', false)
union all select '0009 delivery settings', exists (select 1 from public.settings where key = 'same_day_reminder_enabled')
union all select '0010 attachments', to_regclass('public.event_attachments') is not null
  and exists (select 1 from storage.buckets where id = 'event-attachments' and public = false)
union all select '0011 nakhon sawan data', exists (select 1 from public.departments where id = '00000000-0000-0000-0000-000000000101')
union all select '0012 reminders/conflict', exists (select 1 from pg_proc where proname = 'enqueue_event_reminders')
  and exists (select 1 from pg_proc where proname = 'check_staff_conflict')
union all select '0013 monitor board',
  coalesce(pg_get_function_result(to_regprocedure('public.get_monitor_events()')) like '%assignee_detail%', false)
union all select 'มี admin อย่างน้อย 1 คน', exists (select 1 from public.profiles where role = 'admin')
union all select 'มีบุคลากรในระบบ', exists (select 1 from public.people);
