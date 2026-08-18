-- =========================================================================
-- PR-OS: Combined Migrations (0009 to 0012)
-- Execute this file in Supabase SQL Editor to apply all pending schema updates.
-- =========================================================================

-- =========================================================================
-- 1. Migration 0009: Notification Delivery Settings
-- =========================================================================
insert into public.settings (key, value, description) values
  ('same_day_reminder_enabled', 'false', 'ส่งแจ้งเตือนซ้ำ 1 ชั่วโมงก่อนงานในวันเดียวกัน'),
  ('fallback_to_email_when_line_fails', 'true', 'ถ้าส่ง LINE ไม่สำเร็จ ให้ลองส่ง Email แทนถ้ามีอีเมลในระบบ'),
  ('fallback_to_email_when_quota_exceeded', 'true', 'ถ้าโควต้า LINE รายเดือนเต็ม ให้ส่ง Email แทนถ้ามีอีเมลในระบบ')
on conflict (key) do nothing;

-- =========================================================================
-- 2. Migration 0010: Private Event Attachments
-- =========================================================================
create table if not exists public.event_attachments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists event_attachments_event_idx
  on public.event_attachments (event_id)
  where deleted_at is null;

alter table public.event_attachments enable row level security;

drop policy if exists event_attachments_read on public.event_attachments;
create policy event_attachments_read on public.event_attachments for select
  using (
    public.current_app_role() in ('admin', 'supervisor', 'staff')
    or exists (
      select 1 from public.assignments a
      where a.event_id = event_attachments.event_id
        and a.person_id = public.current_person_id()
        and a.assignment_status = 'assigned'
    )
  );

drop policy if exists event_attachments_write on public.event_attachments;
create policy event_attachments_write on public.event_attachments for all
  using (public.current_app_role() in ('admin', 'supervisor', 'staff'))
  with check (public.current_app_role() in ('admin', 'supervisor', 'staff'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-attachments',
  'event-attachments',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.attachment_event_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception
  when others then
    return null;
end;
$$;

drop policy if exists event_attachments_object_read on storage.objects;
create policy event_attachments_object_read on storage.objects for select
  to authenticated
  using (
    bucket_id = 'event-attachments'
    and (
      public.current_app_role() in ('admin', 'supervisor', 'staff')
      or exists (
        select 1 from public.assignments a
        where a.event_id = public.attachment_event_id(storage.objects.name)
          and a.person_id = public.current_person_id()
          and a.assignment_status = 'assigned'
      )
    )
  );

drop policy if exists event_attachments_object_insert on storage.objects;
create policy event_attachments_object_insert on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-attachments'
    and public.current_app_role() in ('admin', 'supervisor', 'staff')
    and public.attachment_event_id(storage.objects.name) is not null
  );

drop policy if exists event_attachments_object_delete on storage.objects;
create policy event_attachments_object_delete on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'event-attachments'
    and public.current_app_role() in ('admin', 'supervisor', 'staff')
  );

-- =========================================================================
-- 3. Migration 0011: Nakhon Sawan Municipality Master Data
-- =========================================================================
insert into public.departments (id, name, short_name, is_active) values
  ('00000000-0000-0000-0000-000000000101', 'สำนักปลัดเทศบาล', 'สป.', true),
  ('00000000-0000-0000-0000-000000000102', 'สำนักการศึกษา', 'กศ.', true),
  ('00000000-0000-0000-0000-000000000103', 'สำนักการสาธารณสุขและสิ่งแวดล้อม', 'สธ.', true),
  ('00000000-0000-0000-0000-000000000104', 'สำนักการคลัง', 'บค.', true),
  ('00000000-0000-0000-0000-000000000105', 'สำนักการช่าง', 'บช.', true),
  ('00000000-0000-0000-0000-000000000106', 'สำนักการแพทย์', 'พบ.', true),
  ('00000000-0000-0000-0000-000000000107', 'กองยุทธศาสตร์และงบประมาณ', 'ยก.', true),
  ('00000000-0000-0000-0000-000000000108', 'กองสวัสดิการสังคม', 'พส.', true),
  ('00000000-0000-0000-0000-000000000109', 'ฝ่ายบริการและเผยแพร่วิชาการ (งานประชาสัมพันธ์)', 'ปชส.', true),
  ('00000000-0000-0000-0000-000000000110', 'สภาเทศบาลนครนครสวรรค์', 'สภาฯ', true)
on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  is_active = excluded.is_active;

insert into public.locations (id, name, description, is_active) values
  ('00000000-0000-0000-0000-000000000201', 'ห้องประชุมสภาเทศบาลนครนครสวรรค์', 'ชั้น 3 อาคารสำนักงานเทศบาล', true),
  ('00000000-0000-0000-0000-000000000202', 'ห้องประชุม 1', 'ชั้น 2 อาคารสำนักงานเทศบาล', true),
  ('00000000-0000-0000-0000-000000000203', 'ห้องประชุมเสือพ่นน้ำ', 'อาคาร 2 เทศบาลนครนครสวรรค์', true),
  ('00000000-0000-0000-0000-000000000204', 'พาสาน (อาคารสัญลักษณ์ต้นแม่น้ำเจ้าพระยา)', 'เกาะยม ต้นแม่น้ำเจ้าพระยา', true),
  ('00000000-0000-0000-0000-000000000205', 'อุทยานสวรรค์ (หนองสมบุญ)', 'สวนสาธารณะใจกลางเมือง', true),
  ('00000000-0000-0000-0000-000000000206', 'ลานอเนกประสงค์ริมเขื่อนเจ้าพระยา', 'ริมเขื่อนแม่น้ำเจ้าพระยา', true),
  ('00000000-0000-0000-0000-000000000207', 'อาคารสัมมนาและจัดแสดงนิทรรศการ', 'อุทยานสวรรค์', true),
  ('00000000-0000-0000-0000-000000000208', 'โรงเรียนในสังกัดเทศบาลนครนครสวรรค์ (ท.1-ท.9)', 'โปรดระบุชื่อโรงเรียนในหมายเหตุ', true)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active;

insert into public.event_types (id, name, color, is_active) values
  ('00000000-0000-0000-0000-000000000301', 'พิธีการ / รัฐพิธี', 'blue', true),
  ('00000000-0000-0000-0000-000000000302', 'ลงพื้นที่ / ตรวจงาน', 'teal', true),
  ('00000000-0000-0000-0000-000000000303', 'ประชุม / สัมมนา', 'gray', true),
  ('00000000-0000-0000-0000-000000000304', 'แถลงข่าว / ประชาสัมพันธ์', 'amber', true),
  ('00000000-0000-0000-0000-000000000305', 'งานประเพณี / วัฒนธรรม', 'coral', true),
  ('00000000-0000-0000-0000-000000000306', 'บริการประชาชน / กิจกรรมชุมชน', 'green', true)
on conflict (id) do update set
  name = excluded.name,
  color = excluded.color,
  is_active = excluded.is_active;

insert into public.roles (id, code, name, color, is_active) values
  ('00000000-0000-0000-0000-000000000401', 'mc', 'พิธีกร', 'teal', true),
  ('00000000-0000-0000-0000-000000000402', 'photo', 'ช่างภาพนิ่ง', 'blue', true),
  ('00000000-0000-0000-0000-000000000403', 'writer', 'ทำข่าว / ข้อมูล', 'indigo', true),
  ('00000000-0000-0000-0000-000000000404', 'coord', 'ประสานงาน', 'amber', true),
  ('00000000-0000-0000-0000-000000000405', 'live', 'ช่างภาพวิดีโอ / ถ่ายทอดสด', 'coral', true),
  ('00000000-0000-0000-0000-000000000406', 'driver', 'ยานพาหนะ / พลขับ', 'gray', true)
on conflict (id) do update set
  name = excluded.name,
  code = excluded.code,
  color = excluded.color,
  is_active = excluded.is_active;

-- =========================================================================
-- 4. Migration 0012: Dual Reminders & Conflict Check
-- =========================================================================
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
  v_default_hours int := 24;
  v_same_day boolean := true;
  v_event_start timestamptz;
  v_advance_time timestamptz;
  v_sameday_time timestamptz;
  v_month text := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM');
begin
  if public.current_app_role() not in ('admin', 'supervisor', 'staff') then
    raise exception 'insufficient role to enqueue reminders';
  end if;

  select id, event_date, start_time, status into v_event
  from public.events
  where id = p_event_id and status = 'published';

  if not found then
    return 0;
  end if;

  select coalesce(nullif(value, '')::int, 24) into v_default_hours
  from public.settings where key = 'default_reminder_hours';

  select coalesce(value = 'true', true) into v_same_day
  from public.settings where key = 'same_day_reminder_enabled';

  v_event_start := (v_event.event_date::text || ' ' || coalesce(v_event.start_time::text, '09:00:00'))::timestamp at time zone 'Asia/Bangkok';
  v_advance_time := v_event_start - (v_default_hours || ' hours')::interval;
  v_sameday_time := v_event_start - interval '1.5 hours';

  -- Advance Reminder
  if v_advance_time > now() then
    insert into public.notifications
      (event_id, assignment_id, person_id, channel, notification_type, scheduled_for, status, quota_month)
    select
      p_event_id,
      a.id,
      a.person_id,
      case when p.line_user_id is not null then 'line'::notification_channel else 'email'::notification_channel end,
      'reminder'::notification_type,
      v_advance_time,
      'queued',
      v_month
    from public.assignments a
    join public.people p on p.id = a.person_id
    where a.event_id = p_event_id
      and a.assignment_status = 'assigned'
      and not exists (
        select 1 from public.notifications n
        where n.assignment_id = a.id
          and n.notification_type = 'reminder'
          and n.scheduled_for = v_advance_time
          and n.status in ('queued', 'sent')
      );
    get diagnostics v_count = row_count;
  end if;

  -- Same-day Reminder
  if v_same_day and v_sameday_time > now() then
    insert into public.notifications
      (event_id, assignment_id, person_id, channel, notification_type, scheduled_for, status, quota_month)
    select
      p_event_id,
      a.id,
      a.person_id,
      case when p.line_user_id is not null then 'line'::notification_channel else 'email'::notification_channel end,
      'reminder'::notification_type,
      v_sameday_time,
      'queued',
      v_month
    from public.assignments a
    join public.people p on p.id = a.person_id
    where a.event_id = p_event_id
      and a.assignment_status = 'assigned'
      and not exists (
        select 1 from public.notifications n
        where n.assignment_id = a.id
          and n.notification_type = 'reminder'
          and n.scheduled_for = v_sameday_time
          and n.status in ('queued', 'sent')
      );
  end if;

  return v_count;
end;
$$;

create or replace function public.cancel_event_reminders(
  p_event_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
begin
  if public.current_app_role() not in ('admin', 'supervisor', 'staff') then
    raise exception 'insufficient role to cancel reminders';
  end if;

  update public.notifications
  set status = 'skipped',
      error_message = 'งานถูกยกเลิก: ยกเลิกการเตือนล่วงหน้า'
  where event_id = p_event_id
    and status = 'queued'
    and notification_type = 'reminder';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.check_staff_conflict(
  p_person_id uuid,
  p_event_date date,
  p_start_time time,
  p_end_time time default null,
  p_exclude_event_id uuid default null
)
returns table (
  conflicting_event_id uuid,
  conflicting_event_title text,
  conflicting_start_time time,
  conflicting_end_time time,
  conflicting_location_name text,
  conflicting_role_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.current_app_role() not in ('admin', 'supervisor', 'staff')
     and public.current_person_id() is distinct from p_person_id then
    raise exception 'insufficient role to check staff conflict';
  end if;

  return query
  select
    e.id as conflicting_event_id,
    e.title as conflicting_event_title,
    e.start_time as conflicting_start_time,
    e.end_time as conflicting_end_time,
    coalesce(l.name, '—') as conflicting_location_name,
    coalesce(r.name, '—') as conflicting_role_name
  from public.assignments a
  join public.events e on e.id = a.event_id
  left join public.locations l on l.id = e.location_id
  left join public.roles r on r.id = a.role_id
  where a.person_id = p_person_id
    and a.assignment_status = 'assigned'
    and e.status in ('published', 'draft')
    and e.deleted_at is null
    and e.event_date = p_event_date
    and (p_exclude_event_id is null or e.id <> p_exclude_event_id)
    -- Time overlap check:
    -- If end_time is null, assume 2-hour duration for comparison
    and (
      (p_start_time, coalesce(p_end_time, p_start_time + interval '2 hours'))
      overlaps
      (e.start_time, coalesce(e.end_time, e.start_time + interval '2 hours'))
    );
end;
$$;

revoke all on function public.enqueue_event_reminders(uuid) from public;
revoke all on function public.cancel_event_reminders(uuid) from public;
revoke all on function public.check_staff_conflict(uuid, date, time, time, uuid) from public;

grant execute on function public.enqueue_event_reminders(uuid) to authenticated;
grant execute on function public.cancel_event_reminders(uuid) to authenticated;
grant execute on function public.check_staff_conflict(uuid, date, time, time, uuid) to authenticated;
