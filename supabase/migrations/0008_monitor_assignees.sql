-- Add assignee person names to the monitor feed so the clean table view can
-- show a real "ผู้รับผิดชอบ" column (name + role), not just role names.
-- Still monitor-safe: names/roles are operational board info (same as the
-- physical whiteboard); no phone/email/internal notes/attachments.
-- Return type changes -> drop before recreate, then re-grant.

drop function if exists public.get_monitor_events();

create function public.get_monitor_events()
returns table (
  id uuid,
  title text,
  event_date date,
  start_time time,
  end_time time,
  short_note text,
  location_name text,
  department_short text,
  roles text[],
  assignees text[],
  total_assignments int,
  acknowledged_assignments int,
  has_changes boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.title,
    e.event_date,
    e.start_time,
    e.end_time,
    e.short_note,
    l.name as location_name,
    d.short_name as department_short,
    coalesce(
      array_agg(distinct r.name) filter (where r.name is not null),
      '{}'
    ) as roles,
    coalesce(
      array_agg(distinct (p.display_name || ' (' || r.name || ')'))
        filter (where p.display_name is not null),
      '{}'
    ) as assignees,
    count(distinct a.id)::int as total_assignments,
    count(distinct ack.assignment_id)::int as acknowledged_assignments,
    e.has_changes
  from public.events e
  left join public.locations l on l.id = e.location_id
  left join public.departments d on d.id = e.owner_department_id
  left join public.assignments a
    on a.event_id = e.id and a.assignment_status = 'assigned'
  left join public.roles r on r.id = a.role_id
  left join public.people p on p.id = a.person_id
  left join public.v_assignment_ack_status ack
    on ack.assignment_id = a.id and ack.ack_status = 'acknowledged'
  where e.status = 'published'
    and e.deleted_at is null
    and e.event_date >= (now() at time zone 'Asia/Bangkok')::date
    and e.event_date <= (now() at time zone 'Asia/Bangkok')::date + 7
  group by e.id, l.name, d.short_name
  order by e.event_date, e.start_time;
$$;

revoke all on function public.get_monitor_events() from public;
grant execute on function public.get_monitor_events() to anon, authenticated;
