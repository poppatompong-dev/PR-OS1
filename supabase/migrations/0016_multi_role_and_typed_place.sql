-- 0016 · คนเดียวหลายหน้าที่ + สถานที่พิมพ์เองได้ (owner, 26 ต.ค. 2569)
--
-- 1) หลายหน้าที่ในงานเดียว: ยังเป็น assignment แถวเดียวต่อคนต่องาน
--    (การ์ดเดียว รับทราบครั้งเดียว ใช้โควต้า 1) เพิ่มหน้าที่รองไว้ใน extra_role_ids
--    role_id เดิม = หน้าที่แรก ไม่ต้องย้ายข้อมูลเก่า
-- 2) สถานที่พิมพ์เอง: ชื่อที่พิมพ์ใหม่เก็บเป็นแถวใน locations ที่ is_custom = true
--    ไม่ขึ้นในรายชื่อหลักของหน้าตั้งค่า แต่การ์ดไลน์ จอทีวี รายงาน อ่านชื่อได้เหมือนเดิม
--
-- รันครั้งเดียวใน Supabase SQL Editor ก่อนขึ้นโค้ดชุดนี้ รันซ้ำได้ (if not exists / or replace)

-- 1. columns -------------------------------------------------------------------
alter table public.assignments
  add column if not exists extra_role_ids uuid[] not null default '{}';

alter table public.locations
  add column if not exists is_custom boolean not null default false;

-- 2. ชื่อหน้าที่ทั้งหมดของ assignment หนึ่งแถว เช่น "ช่างภาพนิ่ง · ทำข่าว / ข้อมูล" ---------
-- เป็น computed column ของ PostgREST: select('role_names') ได้ตรง ๆ จากตาราง assignments
create or replace function public.role_names(a public.assignments)
returns text
language sql
stable
set search_path = public
as $$
  select string_agg(r.name, ' · ' order by u.ord)
  from unnest(array[a.role_id] || coalesce(a.extra_role_ids, '{}')) with ordinality as u(id, ord)
  join public.roles r on r.id = u.id;
$$;

grant execute on function public.role_names(public.assignments) to authenticated, service_role;

-- 3. จอทีวี: แสดงทุกหน้าที่ของแต่ละคน (ชนิดผลลัพธ์เดิม) ----------------------------------
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
    coalesce(array_agg(distinct public.role_names(a)) filter (where a.id is not null), '{}'),
    coalesce(array_agg(distinct (p.display_name || ' (' || public.role_names(a) || ')'))
      filter (where p.display_name is not null), '{}'),
    coalesce(jsonb_agg(distinct jsonb_build_object(
      'name', p.display_name, 'role', public.role_names(a), 'ack', (ack.assignment_id is not null),
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

-- 4. เช็กงานชนกัน: บอกทุกหน้าที่ของงานที่ชน (ชนิดผลลัพธ์เดิม) -----------------------------
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
  if coalesce(public.current_app_role()::text, '') not in ('admin', 'supervisor', 'staff')
     and (public.current_person_id() is null or public.current_person_id() <> p_person_id) then
    raise exception 'insufficient role to check staff conflict';
  end if;

  return query
  select
    e.id as conflicting_event_id,
    e.title as conflicting_event_title,
    e.start_time as conflicting_start_time,
    e.end_time as conflicting_end_time,
    coalesce(l.name, '—') as conflicting_location_name,
    coalesce(public.role_names(a), '—') as conflicting_role_name
  from public.assignments a
  join public.events e on e.id = a.event_id
  left join public.locations l on l.id = e.location_id
  where a.person_id = p_person_id
    and a.assignment_status = 'assigned'
    and e.status in ('published', 'draft')
    and e.deleted_at is null
    and e.event_date = p_event_date
    and (p_exclude_event_id is null or e.id <> p_exclude_event_id)
    and (
      (p_start_time, coalesce(p_end_time, p_start_time + interval '2 hours'))
      overlaps
      (e.start_time, coalesce(e.end_time, e.start_time + interval '2 hours'))
    );
end;
$$;

revoke all on function public.check_staff_conflict(uuid, date, time, time, uuid) from public, anon;
grant execute on function public.check_staff_conflict(uuid, date, time, time, uuid) to authenticated;

-- ให้ PostgREST เห็นคอลัมน์/ฟังก์ชันใหม่ทันที
notify pgrst, 'reload schema';
