-- PR-OS monitor feed: SECURITY DEFINER functions that return only monitor-safe
-- fields for the public display screen, so the /monitor page can read data
-- without a user session and without exposing private columns
-- (no phone numbers, internal notes, emails, or attachment URLs).
--
-- Apply after 0002. Review display-token gating before exposing on a public network.

-- Published events for today..+7 days, with safe summary fields only.
create or replace function public.get_monitor_events()
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
  total_assignments int,
  acknowledged_assignments int
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
    count(distinct a.id)::int as total_assignments,
    count(distinct ack.assignment_id)::int as acknowledged_assignments
  from public.events e
  left join public.locations l on l.id = e.location_id
  left join public.departments d on d.id = e.owner_department_id
  left join public.assignments a
    on a.event_id = e.id and a.assignment_status = 'assigned'
  left join public.roles r on r.id = a.role_id
  left join public.v_assignment_ack_status ack
    on ack.assignment_id = a.id and ack.ack_status = 'acknowledged'
  where e.status = 'published'
    and e.deleted_at is null
    and e.event_date >= (now() at time zone 'Asia/Bangkok')::date
    and e.event_date <= (now() at time zone 'Asia/Bangkok')::date + 7
  group by e.id, l.name, d.short_name
  order by e.event_date, e.start_time;
$$;

-- Active PR team list (name + position only) for the monitor "team" channel.
-- "position" is quoted because it is a reserved word in this context.
create or replace function public.get_monitor_team()
returns table (id uuid, display_name text, position_title text)
language sql
stable
security definer
set search_path = public
as $$
  select id, display_name, "position"
  from public.people
  where is_active = true
  order by display_name;
$$;

revoke all on function public.get_monitor_events() from public;
revoke all on function public.get_monitor_team() from public;
grant execute on function public.get_monitor_events() to anon, authenticated;
grant execute on function public.get_monitor_team() to anon, authenticated;
