-- PR-OS auth integration, RLS policies, and reporting views.
-- Apply after 0001_initial_schema.sql.
--
-- Context: 0001 enables row level security on every table but defines NO policies,
-- which means authenticated users are denied all rows. This migration:
--   1. Adds a profiles table mapping auth.users -> app role + people row
--   2. Adds SECURITY DEFINER helpers so policies can read the caller's role safely
--   3. Defines the actual RLS policies per docs/08-security-and-permissions.md
--   4. Adds the reporting views listed in docs/04-data-model.md
--
-- Review against the live Supabase project before storing production data.

-- =========================================================================
-- 1. Profiles: link Supabase auth users to an app role and a people record
-- =========================================================================

create type app_role as enum ('admin', 'supervisor', 'staff', 'assignee', 'display');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role app_role not null default 'assignee',
  person_id uuid references public.people(id),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- 2. RLS helpers (SECURITY DEFINER avoids infinite recursion on profiles)
-- =========================================================================

create or replace function public.current_app_role()
returns app_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_person_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select person_id from public.profiles where id = auth.uid();
$$;

-- =========================================================================
-- 3. RLS policies
-- =========================================================================

-- profiles: a user sees their own row; admins see/manage all.
create policy profiles_self_read on public.profiles for select
  using (id = auth.uid() or public.current_app_role() = 'admin');
create policy profiles_admin_write on public.profiles for all
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- Master data: any authenticated user reads; only admin writes.
create policy people_read on public.people for select using (auth.uid() is not null);
create policy people_admin_write on public.people for all
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy departments_read on public.departments for select using (auth.uid() is not null);
create policy departments_admin_write on public.departments for all
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy locations_read on public.locations for select using (auth.uid() is not null);
create policy locations_admin_write on public.locations for all
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy event_types_read on public.event_types for select using (auth.uid() is not null);
create policy event_types_admin_write on public.event_types for all
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy roles_read on public.roles for select using (auth.uid() is not null);
create policy roles_admin_write on public.roles for all
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- events: backend roles see all; assignees see only events they are assigned to.
create policy events_read on public.events for select
  using (
    public.current_app_role() in ('admin', 'supervisor', 'staff')
    or exists (
      select 1 from public.assignments a
      where a.event_id = events.id
        and a.person_id = public.current_person_id()
        and a.assignment_status = 'assigned'
    )
  );
create policy events_insert on public.events for insert
  with check (public.current_app_role() in ('admin', 'supervisor', 'staff'));
create policy events_update on public.events for update
  using (public.current_app_role() in ('admin', 'supervisor', 'staff'))
  with check (public.current_app_role() in ('admin', 'supervisor', 'staff'));
-- No delete policy: events are soft-deleted via events.deleted_at.

-- assignments: backend roles manage all; assignees read their own.
create policy assignments_read on public.assignments for select
  using (
    public.current_app_role() in ('admin', 'supervisor', 'staff')
    or person_id = public.current_person_id()
  );
create policy assignments_write on public.assignments for all
  using (public.current_app_role() in ('admin', 'supervisor', 'staff'))
  with check (public.current_app_role() in ('admin', 'supervisor', 'staff'));

-- acknowledgements: assignee inserts ack for their own active assignment version.
create policy ack_read on public.acknowledgements for select
  using (
    public.current_app_role() in ('admin', 'supervisor', 'staff')
    or acknowledged_by = public.current_person_id()
  );
create policy ack_insert on public.acknowledgements for insert
  with check (
    acknowledged_by = public.current_person_id()
    and exists (
      select 1 from public.assignments a
      where a.id = assignment_id
        and a.person_id = public.current_person_id()
        and a.assignment_status = 'assigned'
        and a.assignment_version = acknowledgements.assignment_version
    )
  );

-- audit_logs: append-only. Backend roles insert; admin/supervisor read.
-- (No update/delete policy => updates and deletes are denied.)
create policy audit_read on public.audit_logs for select
  using (public.current_app_role() in ('admin', 'supervisor'));
create policy audit_insert on public.audit_logs for insert
  with check (public.current_app_role() in ('admin', 'supervisor', 'staff'));

-- notifications: admin/supervisor read. Writes happen via the service role
-- (background job) which bypasses RLS, so no write policy is defined here.
create policy notifications_read on public.notifications for select
  using (public.current_app_role() in ('admin', 'supervisor'));

-- settings: any authenticated user reads; admin writes.
create policy settings_read on public.settings for select using (auth.uid() is not null);
create policy settings_admin_write on public.settings for all
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- display_tokens: admin only. The monitor feed validates tokens server-side
-- with the service role, not through user RLS.
create policy display_tokens_admin on public.display_tokens for all
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- =========================================================================
-- 4. Reporting views (security_invoker so the caller's RLS still applies)
-- =========================================================================

-- Published-ish schedule feed with joined master data and ack counts.
create view public.v_event_schedule
  with (security_invoker = true) as
select
  e.id,
  e.title,
  e.event_date,
  e.start_time,
  e.end_time,
  e.status,
  e.urgency,
  e.short_note,
  l.name as location_name,
  d.name as owner_department_name,
  t.name as event_type_name,
  t.color as event_type_color,
  count(a.id) as assignment_count,
  count(ack.assignment_id) as acknowledged_count
from public.events e
left join public.locations l on l.id = e.location_id
left join public.departments d on d.id = e.owner_department_id
left join public.event_types t on t.id = e.event_type_id
left join public.assignments a
  on a.event_id = e.id and a.assignment_status = 'assigned'
left join public.v_assignment_ack_status ack
  on ack.assignment_id = a.id and ack.ack_status = 'acknowledged'
where e.deleted_at is null
group by e.id, l.name, d.name, t.name, t.color;

-- Workload counts per person / role / date for management reports.
create view public.v_workload_by_person
  with (security_invoker = true) as
select
  p.id as person_id,
  p.display_name,
  r.name as role_name,
  e.event_date,
  count(*) as event_count
from public.assignments a
join public.people p on p.id = a.person_id
join public.roles r on r.id = a.role_id
join public.events e on e.id = a.event_id
where a.assignment_status = 'assigned' and e.deleted_at is null
group by p.id, p.display_name, r.name, e.event_date;

-- Significant-change and cancellation counts, derived from the audit trail.
-- Expects audit_logs.action codes 'significant_change' and 'cancel' on entity_type 'event'.
create view public.v_event_change_summary
  with (security_invoker = true) as
select
  date(al.changed_at) as change_date,
  count(*) filter (where al.action = 'significant_change') as changed_count,
  count(*) filter (where al.action = 'cancel') as canceled_count
from public.audit_logs al
where al.entity_type = 'event'
group by date(al.changed_at);

-- Monthly notification usage by channel for the LINE free-quota guard.
create view public.v_notification_quota
  with (security_invoker = true) as
select
  quota_month,
  channel,
  count(*) filter (where status = 'sent') as sent_count,
  count(*) filter (where status = 'failed') as failed_count,
  count(*) filter (where status = 'skipped') as skipped_count,
  count(*) as total_count
from public.notifications
group by quota_month, channel;
