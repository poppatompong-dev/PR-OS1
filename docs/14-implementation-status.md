# Implementation Status

สถานะการพัฒนา PR-OS (อัปเดตต่อเนื่องตามงานจริง) — ล่าสุด 30 มิถุนายน 2569

ระบบเชื่อมต่อ **Supabase จริง** (Auth + PostgreSQL + RLS + SECURITY DEFINER functions) แล้ว และทำงานบนแผนฟรีทั้งหมด (ดู `docs/13-setup-free-tier.md`)

## ✅ ทำเสร็จแล้ว (ใช้งานได้จริง)

### Auth & สิทธิ์
- เข้าสู่ระบบด้วย **username/password** (`/login`) — แปลง username → email ฝั่งเซิร์ฟเวอร์ผ่าน `get_login_email()` (อีเมลไม่หลุดไป browser); พิมพ์อีเมลเต็มก็ได้
- Middleware ป้องกัน route ทุกหน้ายกเว้น `/login`, `/monitor`
- Role: `admin / supervisor / staff / assignee / display` + capability checks (`src/lib/auth/roles.ts`)
- RLS เปิดและกำหนด policy ครบทุกตาราง (`0002`) ตรวจสอบแล้ว

### งานประชาสัมพันธ์ (Event lifecycle)
- ตารางงาน `/schedule` — query เดียวกัน N+1, ตัวกรอง สถานะ/หน่วยงาน/ค้นหา (server-side)
- เพิ่มงาน `/events/new` — บันทึกร่าง/เผยแพร่ + audit
- รายละเอียดงาน `/events/[id]` — เผยแพร่ / ปิดงาน / ยกเลิก(ต้องมีเหตุผล) / ลบ(soft) + audit ทุก action
- แก้ไขงาน `/events/[id]/edit` — ตรวจ **significant change** (ชื่อ/วันเวลา/สถานที่) → ตั้ง `has_changes` + **รีเซ็ตการรับทราบ** (bump assignment_version) + audit `significant_change`
- จัดการผู้รับมอบหมายในหน้างาน (เพิ่ม/นำออก)

### มอบหมาย / รับทราบ
- มือถือ `/mobile/my-tasks` — assignee เห็นงานของตน + กด **รับทราบ** จริง (ตาม assignment version ปัจจุบัน)
- RLS: รับทราบได้เฉพาะงานของตัวเอง + version ปัจจุบันเท่านั้น (ตรวจสอบแล้ว)

### จอมอนิเตอร์
- **ค่าเริ่มต้น `/monitor` = ตารางเรียบ อ่านง่าย ตัวใหญ่ พื้นเข้ม** (ตามความเห็นผู้ใช้จริง) — คอลัมน์ วันที่ · เวลา · งาน/กิจกรรม · สถานที่ · ผู้รับผิดชอบ (ชื่อ+บทบาท) · หมายเหตุ; เรียงตามวัน-เวลา; นาฬิกาใหญ่ + auto-refresh 60 วิ (`src/app/monitor/TableMonitor.tsx` + `monitor-table.css`)
- อ่านผ่าน **monitor-safe RPC** `get_monitor_events` (คืนเฉพาะฟิลด์ปลอดภัย: ไม่มีเบอร์โทร/หมายเหตุภายใน/อีเมล/ไฟล์แนบ) — `0008` เพิ่มชื่อผู้รับผิดชอบ + เวลาสิ้นสุด
- **ตัวเลือก `/monitor?classic=1` = จอทีวีย้อนยุค 7 ช่อง** (วาระงาน/ราคาทอง/น้ำมัน/ข่าว/อากาศ/น่าติดตาม/ทีมงาน + มาสคอต) เก็บไว้ตามที่เจ้าของโปรเจกต์ชอบ; จอเต็ม `?classic=1&tv=1`, รีโมท `/monitor/control` (localStorage → production ควรใช้ Supabase Realtime); ราคา/ข่าว/อากาศยังเป็น static ใน `src/lib/signage/data.ts`
- หมายเหตุ: ทิศทาง "ตารางเรียบ" นี้ทับ (supersede) แนวทางลูกเล่นเยอะใน `docs/12` เฉพาะจอมอนิเตอร์

### รายงาน & แดชบอร์ด
- `/reports` — ช่วงวันที่, KPI 6 ตัว, ภาระงานตามบุคคล, รายการค้างรับทราบ, **Smart Summary** แบบกฎคำนวณ
- หน้าแรก `/` — KPI + Smart Summary จากข้อมูลจริง

### ตั้งค่า (ผู้ดูแล) `/settings`
- บุคลากร: เพิ่ม / แก้ไข / เปิด-ปิดใช้งาน
- บัญชีผู้ใช้: ตั้ง **username**, role, ผูกกับบุคลากร (กันถอนสิทธิ์ admin ตัวเอง)
- ข้อมูลหลัก: หน่วยงาน / สถานที่ / ประเภทงาน / บทบาท (เพิ่ม + เปิดปิด)
- การแจ้งเตือน: ตั้งค่า + ดูคิว/ประวัติ + ปุ่มประมวลผลคิว

### การแจ้งเตือน (queue)
- สร้างคิวอัตโนมัติเมื่อ เผยแพร่(`assignment`) / แก้ไขสำคัญ(`change`) / ยกเลิก(`cancellation`) ผ่าน `enqueue_event_notifications()` + กันซ้ำ
- ประมวลผลคิวผ่าน `process_notification_queue()`

## ⚠️ ยังเหลือ / ข้อจำกัด
- **ส่งแจ้งเตือนจริง**: ตัวประมวลผลเป็น **โหมดจำลอง** (mark `skipped`) — ต้องตั้งค่า LINE Messaging API token + Email provider แล้วแทนที่ body ของ `process_notification_queue` ด้วยการส่งจริง + ตั้ง cron (pg_cron/pg_net)
- **ไฟล์แนบ**: ยังไม่ทำ (private Storage bucket + signed URL)
- **Display token**: จอมอนิเตอร์ยังเปิดให้ anon เรียก RPC ได้ (ระดับข้อมูลปลอดภัย) — ยังไม่ได้ทำ token gating
- **Export PDF/Excel** ในรายงาน: ยังไม่ทำ
- `/events/sample-event`: หน้า mock เก่า (ไม่มีลิงก์ไปแล้ว) — รอลบ
- สร้างบัญชี auth จากในแอป: ยังต้องทำผ่าน Supabase dashboard (service_role key ของโปรเจกต์นี้ใช้ไม่ได้)

## Migrations
`0001` schema · `0002` auth/RLS/views · `0003` monitor feed · `0004` DB hardening (triggers/index/constraints/has_changes) · `0005` accounts · `0006` notifications · `0007` username login · `0008` monitor assignees (ชื่อผู้รับผิดชอบ + เวลาสิ้นสุด ในฟีดจอ)

## บัญชีทดสอบ
- admin: username `admin`
- assignee ทดสอบ: username `assignee` / รหัส `Assignee123!` (ผูกบุคลากรทดสอบ + มีงานมอบหมาย พิธีกร ในงานพิธีเปิดฯ)

## สื่อตัวอย่าง (demo)
- คลิป GIF จอมอนิเตอร์สำหรับส่งเจ้าหน้าที่ (อยู่ในเครื่อง โฟลเดอร์ Downloads): `pr-os-monitor-tv.gif` (ช่องวาระงาน, ~2.8MB) และ `pr-os-monitor-7channels.gif` (ไล่ครบ 7 ช่อง, ~7.2MB)

## ▶️ รอบถัดไป (เริ่มที่นี่ครั้งหน้า)
ลำดับที่แนะนำเมื่อกลับมาทำต่อ:
1. **Notifications ส่งจริง** — ตั้งค่า LINE Messaging API token + Email provider, แทน body ของ `process_notification_queue` ด้วยการส่งจริง (mark `sent`/`failed`), เพิ่ม reminder ล่วงหน้า, ตั้ง cron (pg_cron + pg_net) ให้ส่งอัตโนมัติ
2. **ไฟล์แนบ** — private Storage bucket + signed URL (ไม่ให้หลุดบนจอมอนิเตอร์)
3. **Export รายงาน PDF/Excel** ในหน้า `/reports`
4. **Display token** สำหรับจอมอนิเตอร์ (hardening) + ทำให้ราคา/ข่าว/อากาศบนจอเป็นข้อมูลจริง (API) แทน static
5. ลบหน้า mock เก่า `/events/sample-event`

## Quality gates (ผ่านล่าสุด)
`npm run build` ✓ · `npm run lint` ✓ · `npm run typecheck` ✓ · RLS verified ผ่าน rolled-back simulations
