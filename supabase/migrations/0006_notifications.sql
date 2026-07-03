-- PR-OS notification queue: enqueue on event publish/change/cancel, and a
-- processor. The notifications table has no INSERT/UPDATE RLS policy (writes are
-- system-side), so these SECURITY DEFINER functions perform the writes; the
-- event mutations call them after their own permission checks.
--
-- Real LINE/Email delivery is not wired yet (no provider credentials). The
-- processor runs in "simulation" mode: it marks due queued rows as skipped with
-- a clear reason. Replace its body with the real adapter call + mark 'sent'.

-- Queue one notification per active assignment for the given type.
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

  insert into public.notifications
    (event_id, assignment_id, person_id, channel, notification_type, scheduled_for, status, quota_month)
  select
    p_event_id,
    a.id,
    a.person_id,
    case when p.line_user_id is not null
         then 'line'::notification_channel
         else 'email'::notification_channel end,
    p_type,
    now(),
    'queued',
    v_month
  from public.assignments a
  join public.people p on p.id = a.person_id
  where a.event_id = p_event_id
    and a.assignment_status = 'assigned'
    -- de-dup: don't stack an identical still-queued notification
    and not exists (
      select 1 from public.notifications n
      where n.assignment_id = a.id
        and n.notification_type = p_type
        and n.status = 'queued'
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Process due queued notifications. SIMULATION until a provider is configured.
create or replace function public.process_notification_queue()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
begin
  if public.current_app_role() <> 'admin' then
    raise exception 'admin only';
  end if;

  update public.notifications
  set status = 'skipped',
      sent_at = now(),
      error_message = 'โหมดจำลอง: ยังไม่ได้เชื่อมต่อ LINE/Email provider'
  where status = 'queued'
    and scheduled_for <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.enqueue_event_notifications(uuid, notification_type) from public;
revoke all on function public.process_notification_queue() from public;
grant execute on function public.enqueue_event_notifications(uuid, notification_type) to authenticated;
grant execute on function public.process_notification_queue() to authenticated;
