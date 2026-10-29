-- 0018 · เจ้าตัวเลือกเองว่าจะใช้รูปการ์ตูนหรือไม่ และส่งรูปจริงให้ทำใหม่ (owner, 29 Oct 2026)
--   * people.metadata.avatar = 'off' → จอทีวีและเว็บแสดงแค่ชื่อ ไม่แสดงรูป
--   * รูปจริงที่ส่งมาในแชทบอท เก็บใน bucket ส่วนตัว avatar-sources (service role เท่านั้น)
--     ลบทิ้งหลังวาดเสร็จ
-- เพิ่มอย่างเดียว · รันซ้ำได้

drop function if exists public.get_monitor_team();
create function public.get_monitor_team()
returns table (id uuid, display_name text, position_title text, avatar_off boolean)
language sql stable security definer set search_path = public as $$
  select id, display_name, "position", coalesce(metadata->>'avatar' = 'off', false)
  from public.people
  where is_active = true
  order by display_name;
$$;
revoke all on function public.get_monitor_team() from public;
grant execute on function public.get_monitor_team() to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatar-sources', 'avatar-sources', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;
-- ไม่มี policy บน storage.objects สำหรับ bucket นี้ = ผู้ใช้ทั่วไปเปิดไม่ได้ เฉพาะเซิร์ฟเวอร์ (service role)

notify pgrst, 'reload schema';
