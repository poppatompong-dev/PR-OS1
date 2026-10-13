-- 0014_workflow_gaps.sql
--
-- ปิดช่องโหว่การทำงานที่ owner ตัดสินใจเมื่อ 2026-10-13 (ดู STATE.md "ตัดสินใจแล้ว"):
--
--   1) ปุ่ม "ไม่สะดวก" — ผู้รับงานแจ้งพร้อมเหตุผล ระบบติดธงไว้กับ assignment
--      (ไม่ถอดชื่อออก) และแจ้งหัวหน้าทันที หัวหน้าเป็นคนเปลี่ยนคนเอง
--   2) แจ้งหัวหน้าเมื่อเหลือ N ชั่วโมงก่อนงานแล้วยังมีคนไม่รับทราบ (ค่าเริ่มต้น 3)
--   3) สรุปงานพรุ่งนี้รายวัน 17:00 คนละ 1 ข้อความ แทนเตือน 24 ชม. รายงาน
--      (โควต้า LINE ฟรีไทย 300/เดือน — ดู docs/18) ตัวสร้างแถวอยู่ฝั่งแอป
--      src/lib/notifications/digest.ts เพราะเรียกจากตัวประมวลผลคิวด้วย service role
--   4) ช่องเลขที่หนังสือ (ใช้ events.source_reference ที่มีอยู่แล้วตั้งแต่ 0001)
--      + ลิงก์ e-Office (คอลัมน์ใหม่ events.source_url)
--
-- และแก้บั๊กที่มีมาตั้งแต่ 0012: enqueue_event_reminders() ล้มทุกครั้งที่ถูกเรียก
-- เพราะ nullif(value, '') บังคับแปลง '' เป็น jsonb ซึ่งไม่ใช่ JSON ที่ถูกต้อง
-- ("invalid input syntax for type json") แอปไม่ได้ตรวจ error ของ rpc นี้
-- การเตือนล่วงหน้าทั้ง 24 ชม. และ 1.5 ชม. จึงไม่เคยถูกเข้าคิวเลย
--
-- รันซ้ำได้ (idempotent) — ทุกคำสั่งใช้ if not exists / create or replace / on conflict
-- ห้ามรันบน production จนกว่า owner ยืนยัน (Human Gate ใน CLAUDE.md)

-- ---------------------------------------------------------------------------
-- 1. ชนิดการแจ้งเตือนใหม่
--    ค่า enum ใหม่ใช้ใน INSERT ภายในไฟล์เดียวกันไม่ได้จนกว่าจะ commit
--    ไฟล์นี้จึงอ้างถึงค่าเหล่านี้เฉพาะในตัวฟังก์ชัน plpgsql (ถูกตีความตอนเรียกใช้)
-- ---------------------------------------------------------------------------
alter type notification_type add value if not exists 'declined';
alter type notification_type add value if not exists 'escalation';
alter type notification_type add value if not exists 'digest';

-- ---------------------------------------------------------------------------
-- 2. ลิงก์ e-Office — รับเฉพาะ http(s) เพื่อไม่ให้ javascript: ถูกแสดงเป็นลิงก์
-- ---------------------------------------------------------------------------
alter table public.events add column if not exists source_url text;
alter table public.events drop constraint if exists events_source_url_http;
alter table public.events add constraint events_source_url_http
  check (source_url is null or (source_url ~* '^https?://' and length(source_url) <= 500));

comment on column public.events.source_reference is 'เลขที่หนังสือราชการ / เลขอ้างอิงที่มา (ภายใน ไม่แสดงบนจอมอนิเตอร์)';
comment on column public.events.source_url is 'ลิงก์หนังสือในระบบ e-Office (ภายใน ไม่แสดงบนจอมอนิเตอร์)';

-- ---------------------------------------------------------------------------
-- 3. "ไม่สะดวก" ผูกกับ assignment_version เหมือนการรับทราบ
--    ถ้างานถูกแก้สาระสำคัญ (version เพิ่ม) ธงเดิมหมดผล คนนั้นต้องตอบใหม่
-- ---------------------------------------------------------------------------
alter table public.assignments
  add column if not exists declined_at timestamptz,
  add column if not exists declined_version integer,
  add column if not exists decline_reason text;
alter table public.assignments drop constraint if exists assignments_decline_reason_len;
alter table public.assignments add constraint assignments_decline_reason_len
  check (decline_reason is null or length(decline_reason) between 1 and 500);

-- ---------------------------------------------------------------------------
-- 4. กันแถวแจ้งเตือนซ้ำแบบชัดเจน (สรุปรายวัน/แจ้งหัวหน้า อาจถูกสร้างพร้อมกัน
--    จาก cron และปุ่มประมวลผลคิว) — null ไม่ชนกัน แถวเก่าจึงไม่กระทบ
-- ---------------------------------------------------------------------------
alter table public.notifications add column if not exists dedupe_key text;
create unique index if not exists notifications_dedupe_key_uq
  on public.notifications (dedupe_key);

-- ---------------------------------------------------------------------------
-- 5. ค่าตั้งต้น
-- ---------------------------------------------------------------------------
insert into public.settings (key, value, description) values
  ('daily_digest_enabled', 'true', 'ส่งสรุปงานพรุ่งนี้คนละ 1 ข้อความทุกวัน (แทนเตือน 24 ชม. รายงาน)'),
  ('daily_digest_hour', '17', 'ชั่วโมงที่ส่งสรุปงานพรุ่งนี้ (เวลาไทย 0-23)'),
  ('escalation_hours_before', '3', 'แจ้งหัวหน้าเมื่อเหลือกี่ชั่วโมงก่อนงานแล้วยังมีคนไม่รับทราบ (0 = ปิด)')
on conflict (key) do nothing;

-- owner เลือกให้มีเตือน 1.5 ชม. ก่อนงาน (LINE เฉพาะคนที่ยังไม่รับทราบ)
-- 0009 ใส่ค่านี้เป็น false ส่วน seed.sql ใส่ true แล้วแต่ลำดับที่รัน — ตั้งให้ชัด
-- (ฟังก์ชันเตือนเดิมล้มทุกครั้ง จึงยังไม่มีใครเคยเห็นผลของค่านี้มาก่อน)
update public.settings set value = 'true', updated_at = now()
where key = 'same_day_reminder_enabled' and value is distinct from 'true'::jsonb;

-- ---------------------------------------------------------------------------
-- 6. ตัวช่วยอ่าน settings (jsonb) อย่างปลอดภัย — เก็บได้ทั้ง 17 และ "17"
-- ---------------------------------------------------------------------------
create or replace function public.setting_int(p_key text, p_default int)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
  t text;
begin
  select value into v from public.settings where key = p_key;
  if v is null then
    return p_default;
  end if;
  t := v #>> '{}';
  if t ~ '^-?[0-9]+$' then
    return t::int;
  end if;
  return p_default;
end;
$$;

create or replace function public.setting_bool(p_key text, p_default boolean)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  select value into v from public.settings where key = p_key;
  if v is null then
    return p_default;
  end if;
  return coalesce(lower(v #>> '{}') = 'true', p_default);
end;
$$;

-- หัวหน้าที่จะได้รับแจ้ง: บัญชี supervisor ที่ผูกกับบุคลากรที่ยังใช้งานอยู่
-- ถ้าไม่มี supervisor เลย ส่งให้ admin แทน เพื่อไม่ให้การแจ้งหายเงียบ
create or replace function public.supervisor_person_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  with sup as (
    select distinct pr.person_id
    from public.profiles pr
    join public.people p on p.id = pr.person_id and p.is_active
    where pr.role = 'supervisor'
  ),
  adm as (
    select distinct pr.person_id
    from public.profiles pr
    join public.people p on p.id = pr.person_id and p.is_active
    where pr.role = 'admin'
  )
  select person_id from sup
  union all
  select person_id from adm where not exists (select 1 from sup);
$$;

-- ---------------------------------------------------------------------------
-- 7. แจ้ง "ไม่สะดวก"
-- ---------------------------------------------------------------------------
create or replace function public.decline_assignment(
  p_assignment_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person uuid := public.current_person_id();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_month text := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM');
  a record;
  v_removed_ack timestamptz;
begin
  if v_person is null then
    raise exception 'บัญชีนี้ยังไม่ได้ผูกกับรายชื่อบุคลากร';
  end if;
  if v_reason = '' then
    raise exception 'กรุณาระบุเหตุผล';
  end if;
  if length(v_reason) > 500 then
    raise exception 'เหตุผลยาวเกิน 500 ตัวอักษร';
  end if;

  select asg.id, asg.event_id, asg.person_id, asg.assignment_version,
         e.title, e.status, e.deleted_at, e.event_date, e.start_time,
         p.display_name, r.name as role_name
    into a
  from public.assignments asg
  join public.events e on e.id = asg.event_id
  join public.people p on p.id = asg.person_id
  left join public.roles r on r.id = asg.role_id
  where asg.id = p_assignment_id
    and asg.assignment_status = 'assigned';

  if not found or a.person_id is distinct from v_person then
    raise exception 'ไม่พบงานที่ได้รับมอบหมายนี้';
  end if;
  if a.deleted_at is not null or a.status <> 'published' then
    raise exception 'งานนี้ไม่ได้อยู่ในสถานะเผยแพร่';
  end if;
  if (a.event_date::text || ' ' || a.start_time::text)::timestamp at time zone 'Asia/Bangkok' <= now() then
    raise exception 'งานเริ่มไปแล้ว กรุณาแจ้งหัวหน้าโดยตรง';
  end if;

  -- รับทราบแล้วเปลี่ยนใจได้ (เช่น ป่วยกะทันหัน): ถอนการรับทราบของ version นี้
  -- เวลาที่เคยรับทราบเก็บไว้ใน audit log
  with removed as (
    delete from public.acknowledgements
    where assignment_id = a.id and assignment_version = a.assignment_version
    returning acknowledged_at
  )
  select max(acknowledged_at) into v_removed_ack from removed;

  update public.assignments
  set declined_at = now(),
      declined_version = a.assignment_version,
      decline_reason = v_reason
  where id = a.id;

  insert into public.audit_logs (entity_type, entity_id, action, changed_by, summary, new_values, old_values)
  values (
    'event', a.event_id, 'decline', auth.uid(),
    format('แจ้งไม่สะดวก: %s (%s) — %s', a.display_name, coalesce(a.role_name, '—'), v_reason),
    jsonb_build_object('assignment_id', a.id, 'assignment_version', a.assignment_version, 'reason', v_reason),
    case when v_removed_ack is null then '{}'::jsonb
         else jsonb_build_object('acknowledged_at', v_removed_ack) end
  );

  -- แจ้งหัวหน้าทันที (ไม่แจ้งตัวเอง ถ้าคนแจ้งเป็นหัวหน้าเอง)
  insert into public.notifications
    (event_id, assignment_id, person_id, channel, notification_type, scheduled_for, status, quota_month, dedupe_key)
  select
    a.event_id, a.id, sp.id,
    case when sp.line_user_id is not null then 'line'::notification_channel else 'email'::notification_channel end,
    'declined'::notification_type,
    now(), 'queued', v_month,
    format('declined:%s:%s:%s', a.id, a.assignment_version, sp.id)
  from public.people sp
  where sp.id in (select public.supervisor_person_ids())
    and sp.id <> v_person
  on conflict (dedupe_key) do nothing;
end;
$$;

-- รับทราบหลังแจ้งไม่สะดวก = เปลี่ยนใจไปได้แล้ว: ล้างธง
create or replace function public.clear_decline_on_ack()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.assignments
  set declined_at = null, declined_version = null, decline_reason = null
  where id = new.assignment_id
    and declined_at is not null;
  return new;
end;
$$;

drop trigger if exists acknowledgements_clear_decline on public.acknowledgements;
create trigger acknowledgements_clear_decline
  after insert on public.acknowledgements
  for each row execute function public.clear_decline_on_ack();

-- ---------------------------------------------------------------------------
-- 8. ตั้งเวลาเตือน/แจ้งหัวหน้าของงานหนึ่งงาน (แทนตัวเดิมใน 0012 ที่ล้มทุกครั้ง)
--    เรียกซ้ำได้: ตอนเผยแพร่, เพิ่มผู้รับผิดชอบ และเมื่อแก้วัน/เวลา
--    แถวที่ยังรอส่งแต่เวลาไม่ตรงกับกำหนดใหม่จะถูก skip พร้อมเหตุผล
-- ---------------------------------------------------------------------------
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
  v_rows int := 0;
  v_digest boolean := public.setting_bool('daily_digest_enabled', true);
  v_advance_hours int := public.setting_int('default_reminder_hours', 24);
  v_same_day boolean := public.setting_bool('same_day_reminder_enabled', true);
  v_escalation_hours int := public.setting_int('escalation_hours_before', 3);
  v_start timestamptz;
  v_advance timestamptz;
  v_sameday timestamptz;
  v_escalate timestamptz;
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

  v_start := (v_event.event_date::text || ' ' || v_event.start_time::text)::timestamp at time zone 'Asia/Bangkok';
  v_advance := case when not v_digest and v_advance_hours > 0
                    then v_start - make_interval(hours => v_advance_hours) end;
  v_sameday := case when v_same_day then v_start - interval '90 minutes' end;
  v_escalate := case when v_escalation_hours > 0
                     then v_start - make_interval(hours => v_escalation_hours) end;

  -- กำหนดเดิมที่ไม่ตรงกับเวลางานใหม่: ยกเลิก (ปลด dedupe_key ให้สร้างใหม่ได้ถ้าเวลากลับมาเหมือนเดิม)
  update public.notifications
  set status = 'skipped',
      sent_at = now(),
      dedupe_key = null,
      error_message = 'เวลางานเปลี่ยน — ตั้งเวลาเตือนใหม่แล้ว'
  where event_id = p_event_id
    and status = 'queued'
    and notification_type::text in ('reminder', 'escalation')
    and scheduled_for is distinct from v_advance
    and scheduled_for is distinct from v_sameday
    and scheduled_for is distinct from v_escalate;

  -- เตือนผู้รับงาน (ล่วงหน้า ถ้าปิดสรุปรายวัน / ก่อนงาน 1.5 ชม.)
  insert into public.notifications
    (event_id, assignment_id, person_id, channel, notification_type, scheduled_for, status, quota_month, dedupe_key)
  select
    p_event_id, a.id, a.person_id,
    case when p.line_user_id is not null then 'line'::notification_channel else 'email'::notification_channel end,
    'reminder'::notification_type,
    t.at, 'queued', v_month,
    format('reminder:%s:%s', a.id, extract(epoch from t.at)::bigint)
  from public.assignments a
  join public.people p on p.id = a.person_id
  cross join (values (v_advance), (v_sameday)) as t(at)
  where a.event_id = p_event_id
    and a.assignment_status = 'assigned'
    and t.at is not null
    and t.at > now()
  on conflict (dedupe_key) do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  -- แจ้งหัวหน้า N ชม. ก่อนงาน (ตอนส่งจริงจะตรวจอีกครั้งว่ายังมีคนค้างอยู่ไหม)
  if v_escalate is not null and v_escalate > now() then
    insert into public.notifications
      (event_id, assignment_id, person_id, channel, notification_type, scheduled_for, status, quota_month, dedupe_key)
    select
      p_event_id, null, sp.id,
      case when sp.line_user_id is not null then 'line'::notification_channel else 'email'::notification_channel end,
      'escalation'::notification_type,
      v_escalate, 'queued', v_month,
      format('escalation:%s:%s:%s', p_event_id, sp.id, extract(epoch from v_escalate)::bigint)
    from public.people sp
    where sp.id in (select public.supervisor_person_ids())
      and exists (
        select 1 from public.assignments a
        where a.event_id = p_event_id and a.assignment_status = 'assigned'
      )
    on conflict (dedupe_key) do nothing;
    get diagnostics v_rows = row_count;
    v_count := v_count + v_rows;
  end if;

  return v_count;
end;
$$;

-- ยกเลิกงาน: ยกเลิกทั้งเตือนผู้รับงานและแจ้งหัวหน้าที่ยังรอส่ง
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
      sent_at = now(),
      error_message = 'งานถูกยกเลิก: ยกเลิกการเตือนล่วงหน้า'
  where event_id = p_event_id
    and status = 'queued'
    and notification_type::text in ('reminder', 'escalation');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. สิทธิ์
-- ---------------------------------------------------------------------------
revoke all on function public.setting_int(text, int) from public;
revoke all on function public.setting_bool(text, boolean) from public;
revoke all on function public.supervisor_person_ids() from public;
revoke all on function public.clear_decline_on_ack() from public;
revoke all on function public.decline_assignment(uuid, text) from public;
revoke all on function public.enqueue_event_reminders(uuid) from public;
revoke all on function public.cancel_event_reminders(uuid) from public;

grant execute on function public.decline_assignment(uuid, text) to authenticated;
grant execute on function public.enqueue_event_reminders(uuid) to authenticated;
grant execute on function public.cancel_event_reminders(uuid) to authenticated;
