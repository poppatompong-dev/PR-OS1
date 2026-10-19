-- 0014_line_bot.sql — เฟส LINE bot (owner ตัดสินใจ 19 ต.ค. 2569 ดู STATE.md)
--
-- รันมือใน Supabase SQL Editor ครั้งเดียว ทั้งไฟล์ครอบด้วย begin/commit แล้ว
-- ถ้าพังกลางทาง ทุกอย่างจะ rollback เอง ฐานข้อมูลเดิมไม่เสีย
-- ห้ามใช้ supabase db push (ดู STATE.md หัวข้อข้อห้าม)
--
-- สิ่งที่ไฟล์นี้ทำ
--   1. ประเภทแจ้งเตือนใหม่ 4 ชนิด (สรุป 07:00 / รายงานแอดมิน 17:00 / แจ้งไม่สะดวก / เตือนโควต้า)
--   2. ปุ่ม "ไม่สะดวก" — เก็บเหตุผลไว้บนแถว assignments (ไม่ถอดชื่อ แอดมินหาคนแทนเอง)
--   3. ตาราง notification_runs กันส่งสรุปรอบเดียวกันซ้ำ
--   4. ตาราง line_chat_state จำว่าใครกำลังพิมพ์เหตุผล "ไม่สะดวก" อยู่
--   5. LINE userId หนึ่งบัญชีผูกได้กับคนเดียว
--   6. แก้บั๊ก: เพิ่มผู้รับผิดชอบคนที่ 2 แล้วคนแรกได้แจ้งมอบหมายซ้ำ (เปลืองโควต้า)
--   7. เตือนล่วงหน้าเหลือแค่ 1.5 ชม. ก่อนงาน (เตือน 24 ชม. ถูกแทนด้วยสรุป 07:00)
--   8. จอทีวีรู้ว่าใครกด "ไม่สะดวก"
--   9. settings ใหม่: รายชื่อแอดมินที่รับแจ้งเตือนฝั่งแอดมิน, กลุ่มไลน์ที่อนุญาต
--      และเปิดเตือน 1.5 ชม. (owner ตัดสินใจ 19 ต.ค. — ค่า false เดิมเป็นแค่ค่าตั้งต้นของ 0009)
--
-- ไม่ลบตาราง ไม่ลบคอลัมน์ ไม่แก้ RLS ของตารางเดิม ไม่ลบข้อมูล

begin;

-- 1. ประเภทแจ้งเตือนใหม่ -----------------------------------------------------
-- (ADD VALUE ใช้ใน transaction ได้ แต่ห้ามใช้ค่าใหม่ในไฟล์นี้ — ไฟล์นี้จึงไม่ได้ใช้)
alter type public.notification_type add value if not exists 'daily_summary';
alter type public.notification_type add value if not exists 'admin_report';
alter type public.notification_type add value if not exists 'unavailable';
alter type public.notification_type add value if not exists 'quota_warning';

-- 2. ไม่สะดวก ----------------------------------------------------------------
alter table public.assignments
  add column if not exists unavailable_at timestamptz,
  add column if not exists unavailable_reason text;

comment on column public.assignments.unavailable_at is
  'ผู้ถูกมอบหมายกด "ไม่สะดวก" เมื่อไหร่ (null = ไม่ได้แจ้ง) — ล้างเองเมื่อคนนั้นกดรับทราบภายหลัง';

-- กดรับทราบทีหลัง = สะดวกแล้ว ป้าย "ไม่สะดวก" หายเอง
create or replace function public.clear_unavailable_on_ack()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.assignments
     set unavailable_at = null, unavailable_reason = null
   where id = new.assignment_id
     and unavailable_at is not null;
  return new;
end;
$$;

drop trigger if exists acknowledgements_clear_unavailable on public.acknowledgements;
create trigger acknowledgements_clear_unavailable
  after insert on public.acknowledgements
  for each row execute function public.clear_unavailable_on_ack();

-- 3. กันส่งสรุปซ้ำ (เขียนได้เฉพาะ service role — RLS เปิด ไม่มี policy) ---------
create table if not exists public.notification_runs (
  run_key text primary key,          -- เช่น daily:2026-10-20, admin17:2026-10-20, quota:2026-10
  created_at timestamptz not null default now(),
  detail jsonb not null default '{}'
);
alter table public.notification_runs enable row level security;

-- 4. สถานะแชท LINE (service role เท่านั้น) -----------------------------------
create table if not exists public.line_chat_state (
  line_user_id text primary key,
  pending_action text not null,      -- 'unavailable_reason'
  assignment_id uuid references public.assignments(id),
  expires_at timestamptz not null
);
alter table public.line_chat_state enable row level security;

-- 5. LINE userId ซ้ำไม่ได้ ----------------------------------------------------
create unique index if not exists people_line_user_id_key
  on public.people (line_user_id)
  where line_user_id is not null;

-- 6. แจ้งมอบหมายไม่ซ้ำคนเดิม ---------------------------------------------------
-- เดิมกันซ้ำแค่แถวที่ยัง queued อยู่ — พอแถวแรกส่งไปแล้ว (sent) การเพิ่มคนที่ 2
-- จะสร้างแจ้งมอบหมายให้คนแรกอีกรอบ ตอนนี้: assignment ส่งสำเร็จได้ครั้งเดียวต่อการมอบหมาย
-- (แถวที่ถูกข้าม เช่น ตอนยังไม่ผูก LINE ไม่นับ — เผยแพร่/เพิ่มคนครั้งหน้าจะได้รับ)
-- ส่วน change / cancellation ยังส่งใหม่ได้ทุกครั้งที่เกิด (กันซ้ำเฉพาะที่ยัง queued)
-- งานร่างไม่สร้างคิว — คิวจะถูกสร้างตอนเผยแพร่ (ยกเว้นแจ้งยกเลิก ซึ่งเกิดหลังเปลี่ยนสถานะแล้ว)
create or replace function public.enqueue_event_notifications(
  p_event_id uuid,
  p_type notification_type
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_month text := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM');
begin
  if public.current_app_role() not in ('admin', 'supervisor', 'staff') then
    raise exception 'insufficient role to enqueue notifications';
  end if;

  if p_type <> 'cancellation' and not exists (
    select 1 from public.events e
    where e.id = p_event_id and e.status = 'published' and e.deleted_at is null
  ) then
    return 0;
  end if;

  insert into public.notifications
    (event_id, assignment_id, person_id, channel, notification_type, scheduled_for, status, quota_month)
  select
    p_event_id, a.id, a.person_id, 'line'::notification_channel, p_type, now(), 'queued', v_month
  from public.assignments a
  where a.event_id = p_event_id
    and a.assignment_status = 'assigned'
    and not exists (
      select 1 from public.notifications n
      where n.assignment_id = a.id
        and n.notification_type = p_type
        and (
          n.status = 'queued'
          or (p_type = 'assignment' and n.status = 'sent')
        )
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 7. เตือนล่วงหน้า: เหลือแค่ 1.5 ชม. ก่อนเริ่มงาน ------------------------------
-- ตัวส่งจะเช็กอีกชั้นว่าคนนั้นรับทราบแล้วหรือยัง ถ้ารับทราบแล้วจะข้าม (ไม่เปลืองโควต้า)
create or replace function public.enqueue_event_reminders(
  p_event_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_count int := 0;
  v_enabled boolean := true;
  v_remind_at timestamptz;
  v_month text := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM');
begin
  if public.current_app_role() not in ('admin', 'supervisor', 'staff') then
    raise exception 'insufficient role to enqueue reminders';
  end if;

  select id, event_date, start_time into v_event
  from public.events
  where id = p_event_id and status = 'published' and deleted_at is null;
  if not found then
    return 0;
  end if;

  select coalesce(value = 'true'::jsonb or value = '"true"'::jsonb, true) into v_enabled
  from public.settings where key = 'same_day_reminder_enabled';
  if not coalesce(v_enabled, true) then
    return 0;
  end if;

  v_remind_at := ((v_event.event_date::text || ' ' || coalesce(v_event.start_time::text, '09:00:00'))::timestamp
                  at time zone 'Asia/Bangkok') - interval '1.5 hours';
  if v_remind_at <= now() then
    return 0;
  end if;

  insert into public.notifications
    (event_id, assignment_id, person_id, channel, notification_type, scheduled_for, status, quota_month)
  select
    p_event_id, a.id, a.person_id, 'line'::notification_channel, 'reminder'::notification_type,
    v_remind_at, 'queued', v_month
  from public.assignments a
  where a.event_id = p_event_id
    and a.assignment_status = 'assigned'
    and not exists (
      select 1 from public.notifications n
      where n.assignment_id = a.id
        and n.notification_type = 'reminder'
        and n.scheduled_for = v_remind_at
        and n.status in ('queued', 'sent')
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- เตือน 24 ชม. ที่ค้างคิวอยู่เดิม -> ข้าม (สรุป 07:00 ทำหน้าที่แทน)
update public.notifications n
   set status = 'skipped',
       error_message = 'แทนด้วยสรุปงาน 07:00 (0014)'
  from public.events e
 where n.event_id = e.id
   and n.status = 'queued'
   and n.notification_type = 'reminder'
   and n.scheduled_for <> ((e.event_date::text || ' ' || coalesce(e.start_time::text, '09:00:00'))::timestamp
                           at time zone 'Asia/Bangkok') - interval '1.5 hours';

-- 8. จอทีวี: เพิ่ม unavailable ในรายชื่อรายคน (ชนิดผลลัพธ์เดิม ไม่ต้อง drop) ---------
create or replace function public.get_monitor_events()
returns table (
  id uuid, title text, event_date date, start_time time, end_time time,
  short_note text, location_name text, department_short text,
  roles text[], assignees text[], assignee_detail jsonb,
  total_assignments int, acknowledged_assignments int, has_changes boolean,
  status text, cancellation_reason text
)
language sql stable security definer set search_path = public as $$
  select
    e.id, e.title, e.event_date, e.start_time, e.end_time, e.short_note,
    l.name, d.short_name,
    coalesce(array_agg(distinct r.name) filter (where r.name is not null), '{}'),
    coalesce(array_agg(distinct (p.display_name || ' (' || r.name || ')'))
      filter (where p.display_name is not null), '{}'),
    coalesce(jsonb_agg(distinct jsonb_build_object(
      'name', p.display_name, 'role', r.name, 'ack', (ack.assignment_id is not null),
      'unavailable', (a.unavailable_at is not null)
    )) filter (where p.display_name is not null), '[]'::jsonb),
    count(distinct a.id)::int,
    count(distinct ack.assignment_id)::int,
    e.has_changes,
    e.status::text,
    e.cancellation_reason
  from public.events e
  left join public.locations l on l.id = e.location_id
  left join public.departments d on d.id = e.owner_department_id
  left join public.assignments a on a.event_id = e.id and a.assignment_status = 'assigned'
  left join public.roles r on r.id = a.role_id
  left join public.people p on p.id = a.person_id
  left join public.v_assignment_ack_status ack
    on ack.assignment_id = a.id and ack.ack_status = 'acknowledged'
  where e.status in ('published', 'canceled')
    and e.deleted_at is null
    and e.event_date >= (now() at time zone 'Asia/Bangkok')::date
    and e.event_date <= (now() at time zone 'Asia/Bangkok')::date + 7
  group by e.id, l.name, d.short_name
  order by e.event_date, e.start_time;
$$;

revoke all on function public.get_monitor_events() from public;
grant execute on function public.get_monitor_events() to anon, authenticated;

-- 9. settings ----------------------------------------------------------------
-- แอดมินที่รับแจ้ง "ไม่สะดวก" / รายงาน 17:00 / เตือนโควต้า — ตั้งต้นเป็นคนที่ผูกกับบัญชี admin
-- (owner เพิ่มหัวหน้างาน ปชส. เองในหน้า /settings)
insert into public.settings (key, value, description)
select 'line_admin_person_ids',
       coalesce(jsonb_agg(distinct p.person_id) filter (where p.person_id is not null), '[]'::jsonb),
       'รายชื่อ people.id ที่รับแจ้งเตือนฝั่งแอดมินทาง LINE'
from public.profiles p
where p.role = 'admin'
on conflict (key) do nothing;

insert into public.settings (key, value, description)
values ('same_day_reminder_enabled', 'true'::jsonb, 'เตือน 1.5 ชม. ก่อนงาน เฉพาะคนที่ยังไม่รับทราบ')
on conflict (key) do update set value = 'true'::jsonb, updated_at = now();

insert into public.settings (key, value, description)
values ('line_monthly_quota', '300'::jsonb, 'โควต้า LINE OA ต่อเดือน (แผนฟรี 300)')
on conflict (key) do nothing;

-- กลุ่มไลน์ที่บอทยอมตอบ (แอดมินพิมพ์ "อนุญาตกลุ่มนี้" ในกลุ่มเพื่อเพิ่ม)
-- กันคนนอกเชิญบอทเข้ากลุ่มของตัวเองแล้วอ่านตารางงานที่มีชื่อเจ้าหน้าที่
insert into public.settings (key, value, description)
values ('line_allowed_group_ids', '[]'::jsonb, 'groupId ของกลุ่มไลน์ที่บอทตอบคำสั่ง')
on conflict (key) do nothing;

-- ไม่ใช้อีเมลสำรอง (owner เลือก 19 ต.ค. 2569)
update public.settings set value = 'false'::jsonb, updated_at = now()
 where key in ('fallback_to_email_when_line_fails', 'fallback_to_email_when_quota_exceeded');

commit;
