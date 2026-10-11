-- จอทีวีในห้องฝ่ายต้องตอบ 4 คำถามให้ได้ครบ:
--   1) วันนี้ใครไปไหน    2) วันข้างหน้ามีอะไร
--   3) อะไรเปลี่ยนหรือยกเลิก   4) ใครยังไม่รับทราบ
-- ฟีดเดิม (0008) ตอบได้แค่ 1-2 เพราะกรองเฉพาะ status = 'published'
-- และนับการรับทราบเป็นตัวเลขรวม ไม่รู้ว่า "คนไหน" ที่ยังไม่รับทราบ
--
-- ไฟล์นี้จึงเพิ่ม 3 คอลัมน์ให้ฟังก์ชันอ่านอย่างเดียวตัวเดิม:
--   status              -> ให้จอแยกงานที่ถูกยกเลิกออกมาขึ้นแถบประกาศได้
--   cancellation_reason -> เหตุผลที่ยกเลิก (คนเดินผ่านจอจะได้ไม่ต้องถามต่อ)
--   assignee_detail     -> ชื่อ + บทบาท + รับทราบแล้วหรือยัง เป็นราย ๆ คน
--
-- ไม่แตะตาราง ไม่แตะ RLS ไม่เพิ่มสิทธิ์ใหม่ — เป็น SECURITY DEFINER
-- ที่คืนเฉพาะฟิลด์ปลอดภัยสำหรับจอสาธารณะในห้องฝ่ายเหมือนเดิม
-- (ไม่มีเบอร์โทร อีเมล หมายเหตุภายใน หรือไฟล์แนบ)
--
-- คอลัมน์เดิมทั้งหมดยังอยู่ครบ เพื่อให้ /monitor?classic=1 ที่อ่าน
-- assignees text[] ใช้งานได้ต่อโดยไม่ต้องแก้
-- ชนิดผลลัพธ์เปลี่ยน -> ต้อง drop ก่อน create แล้ว grant ใหม่

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
  assignee_detail jsonb,
  total_assignments int,
  acknowledged_assignments int,
  has_changes boolean,
  status text,
  cancellation_reason text
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
    -- ราย ๆ คน: จอต้องชี้ได้ว่าใครยังไม่รับทราบ ไม่ใช่แค่ "ยังไม่รับทราบ 2 คน"
    coalesce(
      jsonb_agg(distinct jsonb_build_object(
        'name', p.display_name,
        'role', r.name,
        'ack', (ack.assignment_id is not null)
      )) filter (where p.display_name is not null),
      '[]'::jsonb
    ) as assignee_detail,
    count(distinct a.id)::int as total_assignments,
    count(distinct ack.assignment_id)::int as acknowledged_assignments,
    e.has_changes,
    e.status::text as status,
    e.cancellation_reason
  from public.events e
  left join public.locations l on l.id = e.location_id
  left join public.departments d on d.id = e.owner_department_id
  left join public.assignments a
    on a.event_id = e.id and a.assignment_status = 'assigned'
  left join public.roles r on r.id = a.role_id
  left join public.people p on p.id = a.person_id
  left join public.v_assignment_ack_status ack
    on ack.assignment_id = a.id and ack.ack_status = 'acknowledged'
  -- งานที่ยกเลิกต้องติดมาด้วย ไม่งั้นจอจะเงียบเฉย ๆ แล้วมีคนไปงานที่ยกเลิกแล้ว
  where e.status in ('published', 'canceled')
    and e.deleted_at is null
    and e.event_date >= (now() at time zone 'Asia/Bangkok')::date
    and e.event_date <= (now() at time zone 'Asia/Bangkok')::date + 7
  group by e.id, l.name, d.short_name
  order by e.event_date, e.start_time;
$$;

revoke all on function public.get_monitor_events() from public;
grant execute on function public.get_monitor_events() to anon, authenticated;
