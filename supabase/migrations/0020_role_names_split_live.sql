-- 0020 · ชื่อหน้าที่ (พี่เอิร์ธ 3 พ.ย. 2569)
--   1) ตัดคำว่า "ช่าง" ออก: ช่างภาพนิ่ง → ภาพนิ่ง
--   2) แยก "ช่างภาพวิดีโอ / ถ่ายทอดสด" เป็น 2 หน้าที่: ภาพวิดีโอ · ถ่ายทอดสด
-- งานเดิมที่เคยเลือกหน้าที่รวมไว้ ได้ทั้ง 2 หน้าที่ต่อ (ความหมายเดิมไม่หาย)
-- แก้ชื่อ/เพิ่มอย่างเดียว ไม่ลบข้อมูล · รันซ้ำได้

update public.roles set name = 'ภาพนิ่ง' where id = '00000000-0000-0000-0000-000000000402';
update public.roles set name = 'ภาพวิดีโอ', code = 'video' where id = '00000000-0000-0000-0000-000000000405';

insert into public.roles (id, code, name, color, is_active) values
  ('00000000-0000-0000-0000-000000000407', 'live', 'ถ่ายทอดสด', 'coral', true)
on conflict (id) do update set name = excluded.name, code = excluded.code, color = excluded.color, is_active = true;

update public.assignments
set extra_role_ids = coalesce(extra_role_ids, '{}') || '{00000000-0000-0000-0000-000000000407}'::uuid[]
where (role_id = '00000000-0000-0000-0000-000000000405'
       or '00000000-0000-0000-0000-000000000405' = any(coalesce(extra_role_ids, '{}')))
  and not ('00000000-0000-0000-0000-000000000407' = any(coalesce(extra_role_ids, '{}')));
