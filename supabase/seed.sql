-- PR-OS development seed data.
-- Use only in local/dev Supabase projects.

insert into public.departments (id, name, short_name) values
  ('00000000-0000-0000-0000-000000000101', 'สำนักปลัดเทศบาล', 'สป.'),
  ('00000000-0000-0000-0000-000000000102', 'กองการศึกษา', 'กศ.'),
  ('00000000-0000-0000-0000-000000000103', 'กองสาธารณสุขและสิ่งแวดล้อม', 'สธ.')
on conflict (id) do nothing;

insert into public.locations (id, name, description) values
  ('00000000-0000-0000-0000-000000000201', 'ห้องประชุมสภาเทศบาล', 'ชั้น 3 อาคารสำนักงาน'),
  ('00000000-0000-0000-0000-000000000202', 'ลานกิจกรรมเทศบาล', 'หน้าอาคารสำนักงาน'),
  ('00000000-0000-0000-0000-000000000203', 'โรงเรียนในสังกัดเทศบาล', 'ระบุโรงเรียนในหมายเหตุ')
on conflict (id) do nothing;

insert into public.event_types (id, name, color) values
  ('00000000-0000-0000-0000-000000000301', 'พิธีการ', 'blue'),
  ('00000000-0000-0000-0000-000000000302', 'ลงพื้นที่', 'teal'),
  ('00000000-0000-0000-0000-000000000303', 'ประชุม', 'gray'),
  ('00000000-0000-0000-0000-000000000304', 'แถลงข่าว', 'amber')
on conflict (id) do nothing;

insert into public.roles (id, code, name, color) values
  ('00000000-0000-0000-0000-000000000401', 'mc', 'พิธีกร', 'teal'),
  ('00000000-0000-0000-0000-000000000402', 'photo', 'ช่างภาพ', 'blue'),
  ('00000000-0000-0000-0000-000000000403', 'writer', 'ทำข่าว', 'indigo'),
  ('00000000-0000-0000-0000-000000000404', 'coord', 'ประสานงาน', 'amber')
on conflict (id) do nothing;

insert into public.people (id, display_name, position, email, line_user_id) values
  ('00000000-0000-0000-0000-000000000501', 'นางสาวภนิตา ชะรัดรัมย์', 'รักษาการในตำแหน่ง หัวหน้าฝ่ายบริการและเผยแพร่วิชาการ', null, null),
  ('00000000-0000-0000-0000-000000000502', 'นายธนันธร พันธุ์รอด', 'หัวหน้างานประชาสัมพันธ์', null, null),
  ('00000000-0000-0000-0000-000000000503', 'นายประชารักษ์ ประทุมโทน', 'นักประชาสัมพันธ์ปฏิบัติการ', null, null),
  ('00000000-0000-0000-0000-000000000504', 'นางสาวณัฏฐ์ จิรจีรังชัย', 'นักประชาสัมพันธ์ปฏิบัติการ', null, null),
  ('00000000-0000-0000-0000-000000000505', 'นางสาวภัททิรา แย้มเผื่อน', 'พนักงานจ้างทั่วไป', null, null),
  ('00000000-0000-0000-0000-000000000506', 'นางสาวเทียมแข กิจกล้า', 'พนักงานจ้างทั่วไป', null, null)
on conflict (id) do update set
  display_name = excluded.display_name,
  position = excluded.position,
  email = excluded.email,
  line_user_id = excluded.line_user_id,
  is_active = true,
  updated_at = now();

insert into public.settings (key, value, description) values
  ('line_enabled', 'true', 'เปิดใช้ LINE notification'),
  ('email_enabled', 'true', 'เปิดใช้ Email fallback'),
  ('line_monthly_quota', '300', 'จำนวนข้อความ LINE ฟรีต่อเดือนสำหรับ pilot'),
  ('default_reminder_hours', '24', 'เวลาแจ้งเตือนล่วงหน้าเริ่มต้นเป็นชั่วโมง')
on conflict (key) do nothing;
