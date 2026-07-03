-- PR-OS DB hardening: auto-updated timestamps, performance indexes for the
-- filters the app actually uses, first-class change tracking, and integrity
-- constraints. Apply after 0003.

-- =========================================================================
-- 1. Auto-update updated_at on every UPDATE
-- =========================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_people_updated_at
  before update on public.people
  for each row execute function public.set_updated_at();

create trigger trg_events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

-- =========================================================================
-- 2. Performance indexes matching real query filters
-- =========================================================================

-- Trigram index for the schedule title search (ilike '%...%').
create extension if not exists pg_trgm;
create index if not exists events_title_trgm_idx
  on public.events using gin (title gin_trgm_ops);

-- Department filter on the schedule.
create index if not exists events_department_idx
  on public.events (owner_department_id);

-- Active (non-deleted) events scanned by status.
create index if not exists events_status_active_idx
  on public.events (status) where deleted_at is null;

-- Acknowledgement lookups by person (mobile my-tasks / ack checks).
create index if not exists acknowledgements_by_idx
  on public.acknowledgements (acknowledged_by);

-- Workload report groups assignments by role.
create index if not exists assignments_role_idx
  on public.assignments (role_id);

-- =========================================================================
-- 3. First-class change tracking (Flow 3 / monitor change indicator)
-- =========================================================================

alter table public.events
  add column if not exists has_changes boolean not null default false;

-- Refresh the monitor feed to expose the new column.
-- (Return type changed, so drop before recreate.)
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
    count(distinct a.id)::int as total_assignments,
    count(distinct ack.assignment_id)::int as acknowledged_assignments,
    e.has_changes
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

-- Re-grant after recreate (drop removed the prior grants).
revoke all on function public.get_monitor_events() from public;
grant execute on function public.get_monitor_events() to anon, authenticated;

-- =========================================================================
-- 4. Integrity constraints
-- =========================================================================

-- End time, when present, must be after start time.
alter table public.events
  add constraint events_time_chk
  check (end_time is null or end_time > start_time);

-- A canceled event must record a reason (Flow 4).
alter table public.events
  add constraint events_cancel_reason_chk
  check (status <> 'canceled' or cancellation_reason is not null);
