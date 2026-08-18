-- 0012_reminders_and_conflict_check.sql
-- Enqueue advance and same-day reminders for published events, and check staff conflicts.

-- 1. Enqueue Reminders RPC
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

  -- Load reminder settings
  select coalesce(nullif(value, '')::int, 24) into v_default_hours
  from public.settings where key = 'default_reminder_hours';

  select coalesce(value = 'true', true) into v_same_day
  from public.settings where key = 'same_day_reminder_enabled';

  -- Calculate event start timestamp in Bangkok time
  v_event_start := (v_event.event_date::text || ' ' || coalesce(v_event.start_time::text, '09:00:00'))::timestamp at time zone 'Asia/Bangkok';
  v_advance_time := v_event_start - (v_default_hours || ' hours')::interval;
  v_sameday_time := v_event_start - interval '1.5 hours';

  -- 1) Advance Reminder (e.g. 24h before) if in the future
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

  -- 2) Same-day Reminder (1.5h before) if enabled and in the future
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

-- 2. Cancel Reminders RPC (when event is canceled or removed)
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
