-- 0017 · Telegram, ประกาศบนจอ (ตัววิ่ง), ชื่อสั้นบนจอ, จอดูงานล่วงหน้า 14 วัน
-- Owner decisions 29 Oct 2026 (พี่เอิร์ธ + คุณกุ๊ก):
--   1. แจ้งเตือนทาง Telegram (ฟรี) เป็นหลัก ใครยังไม่ผูก Telegram ได้ทาง LINE เหมือนเดิม
--   2. ทุกคนพิมพ์ประกาศขึ้นตัววิ่งบนจอทีวีได้ ไม่ต้องอนุมัติ หายเองตอนเที่ยงคืน
--   3. ช่อง "ชื่อสั้นบนจอ" (ไม่บังคับ) สำหรับงานที่ชื่อยาว
--   4. จอทีวีดูงานล่วงหน้าได้ 14 วัน (ผังใหม่มี 4 แถว + 6 ช่อง)
-- เพิ่มอย่างเดียว ไม่ลบ/ไม่แก้ข้อมูลเดิม · รันซ้ำได้

-- 1. ช่องทาง telegram ในตารางแจ้งเตือน ----------------------------------------
alter type public.notification_channel add value if not exists 'telegram';

-- 2. Telegram ของแต่ละคน ----------------------------------------------------------
alter table public.people add column if not exists telegram_chat_id bigint;
create unique index if not exists people_telegram_chat_id_key
  on public.people (telegram_chat_id)
  where telegram_chat_id is not null;

-- ลิงก์ผูก Telegram แบบใช้ครั้งเดียว (บอท LINE ออกให้ หมดอายุ 30 นาที) — service role เท่านั้น
create table if not exists public.telegram_link_tokens (
  token text primary key,
  person_id uuid not null references public.people(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.telegram_link_tokens enable row level security;

-- 3. ชื่อสั้นบนจอ -----------------------------------------------------------------
alter table public.events add column if not exists screen_title text;
do $$ begin
  alter table public.events add constraint events_screen_title_len check (screen_title is null or char_length(screen_title) <= 60);
exception when duplicate_object then null; end $$;

-- 4. ประกาศบนจอ (ตัววิ่ง) -----------------------------------------------------------
create table if not exists public.tv_announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null check (char_length(message) between 1 and 140),
  author_person_id uuid references public.people(id) on delete set null,
  author_name text not null,
  source text not null default 'web',          -- web | line | telegram | event_form
  event_id uuid references public.events(id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists tv_announcements_live_idx on public.tv_announcements (ends_at) where deleted_at is null;
alter table public.tv_announcements enable row level security;
drop policy if exists tv_announcements_read on public.tv_announcements;
create policy tv_announcements_read on public.tv_announcements
  for select to authenticated using (true);
-- เขียน/ลบผ่านเซิร์ฟเวอร์ (service role) เท่านั้น: ทั้งเว็บ แชทบอท และฟอร์ม LINE ใช้กฎเดียวกัน

-- จอทีวี (ไม่ล็อกอิน) อ่านได้แค่ข้อความ ชื่อผู้ประกาศ และเวลาหมดอายุ
create or replace function public.get_monitor_announcements()
returns table (id uuid, message text, author_name text, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, t.message, t.author_name, t.ends_at
  from public.tv_announcements t
  where t.deleted_at is null and t.starts_at <= now() and t.ends_at > now()
  order by t.created_at desc
  limit 20;
$$;
revoke all on function public.get_monitor_announcements() from public;
grant execute on function public.get_monitor_announcements() to anon, authenticated;

-- 5. จอทีวี: 14 วัน + ชื่อสั้นบนจอ (คอลัมน์ใหม่ต่อท้าย จอเดิมยังใช้ได้) -----------------
drop function if exists public.get_monitor_events();
create function public.get_monitor_events()
returns table (
  id uuid, title text, event_date date, start_time time, end_time time,
  short_note text, location_name text, department_short text,
  roles text[], assignees text[], assignee_detail jsonb,
  total_assignments int, acknowledged_assignments int, has_changes boolean,
  status text, cancellation_reason text, screen_title text
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
    e.screen_title
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
