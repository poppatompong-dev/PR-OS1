-- 0019 · ไอคอนประจำงาน (owner 29 Oct 2026)
-- ระบบเดาไอคอนจากชื่องานเอง ช่องนี้เก็บเฉพาะตอนคนเพิ่มงานเลือกเปลี่ยน (ว่าง = เดาจากชื่อ)
-- เพิ่มอย่างเดียว ไม่ลบ/ไม่แก้ข้อมูลเดิม · รันซ้ำได้

alter table public.events add column if not exists icon text;
do $$ begin
  alter table public.events add constraint events_icon_len check (icon is null or char_length(icon) <= 20);
exception when duplicate_object then null; end $$;

-- จอทีวี: เพิ่มคอลัมน์ icon ต่อท้าย (เหมือน 0017 ทุกอย่าง)
drop function if exists public.get_monitor_events();
create function public.get_monitor_events()
returns table (
  id uuid, title text, event_date date, start_time time, end_time time,
  short_note text, location_name text, department_short text,
  roles text[], assignees text[], assignee_detail jsonb,
  total_assignments int, acknowledged_assignments int, has_changes boolean,
  status text, cancellation_reason text, screen_title text, icon text
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
      'unavailable', (a.unavailable_at is not null), 'personId', p.id
    )) filter (where p.display_name is not null), '[]'::jsonb),
    count(distinct a.id)::int,
    count(distinct ack.assignment_id)::int,
    e.has_changes,
    e.status::text,
    e.cancellation_reason,
    e.screen_title,
    e.icon
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
    and e.event_date <= (now() at time zone 'Asia/Bangkok')::date + 14
  group by e.id, l.name, d.short_name
  order by e.event_date, e.start_time;
$$;
revoke all on function public.get_monitor_events() from public;
grant execute on function public.get_monitor_events() to anon, authenticated;

notify pgrst, 'reload schema';
