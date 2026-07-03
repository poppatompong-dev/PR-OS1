-- Additional notification settings needed by the real (non-simulation) queue
-- processor in src/lib/notifications/queue.ts: same-day reminder toggle and
-- LINE->Email fallback behavior. Additive only; existing keys untouched.

insert into public.settings (key, value, description) values
  ('same_day_reminder_enabled', 'false', 'ส่งแจ้งเตือนซ้ำ 1 ชั่วโมงก่อนงานในวันเดียวกัน'),
  ('fallback_to_email_when_line_fails', 'true', 'ถ้าส่ง LINE ไม่สำเร็จ ให้ลองส่ง Email แทนถ้ามีอีเมลในระบบ'),
  ('fallback_to_email_when_quota_exceeded', 'true', 'ถ้าโควต้า LINE รายเดือนเต็ม ให้ส่ง Email แทนถ้ามีอีเมลในระบบ')
on conflict (key) do nothing;
