# Implementation Status

สถานะการพัฒนา PR-OS (อัปเดตต่อเนื่องตามงานจริง) — ล่าสุด 3 กรกฎาคม 2569

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
- ตัวประมวลผลจริง `processDueNotifications()` (`src/lib/notifications/queue.ts`) — ดึงคิวที่ถึงเวลา, ส่ง LINE ผ่าน Messaging API / Email ผ่าน Resend, เช็คโควต้า LINE รายเดือน, fallback ไป email ตาม settings (ตั้งเปิด/ปิดได้ในหน้า `/settings`), อัปเดตสถานะจริง `sent`/`failed`
  - ปุ่ม "ประมวลผลคิว" ในหน้า `/settings` เรียกฟังก์ชันนี้ตรง ๆ แล้ว (เดิมเรียก RPC จำลอง `process_notification_queue` — เลิกใช้แล้ว เก็บ SQL ไว้เป็น reference เฉย ๆ)
  - endpoint `POST /api/notifications/process` ให้ cron ภายนอกเรียกได้ (เช็ค header `x-notifications-secret` เทียบกับ `NOTIFICATIONS_CRON_SECRET`) — route นี้เป็น public path ใน middleware เพราะไม่มี session cookie
  - หน้า `/mobile/my-tasks` มีปุ่ม "เชื่อมต่อ LINE" ให้ assignee ผูกบัญชีเอง (ซ่อนถ้า LINE Login ยังไม่ได้ตั้งค่า หรือผูกแล้ว)
  - **ยังทำงานในโหมดจำลองอยู่จนกว่าจะตั้งค่า env vars จริง** — ดูหัวข้อ "ยังเหลือ/ข้อจำกัด" ด้านล่าง

## ⚠️ ยังเหลือ / ข้อจำกัด
- **ส่งแจ้งเตือนจริง — รอ credential**: โค้ดส่งจริงพร้อมแล้ว แต่ `LINE_LOGIN_CHANNEL_ID`/`LINE_LOGIN_CHANNEL_SECRET`/`LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`/`RESEND_API_KEY`/`NOTIFICATIONS_CRON_SECRET` ยังไม่ถูกตั้งใน `.env.local` จึงยังคง mark `skipped` (โหมดจำลอง) อยู่จนกว่าเจ้าของโปรเจกต์จะใส่ค่าจริง
- **migration `0009_notification_delivery_settings.sql` ยังไม่ได้รันบน Supabase project จริง** — ต้องรันใน SQL Editor ก่อน ไม่งั้น toggle fallback ใหม่ในหน้า settings จะยังบันทึกไม่ได้ตามคาด
- **ยังไม่เขียน pg_cron migration** ให้ยิง `/api/notifications/process` อัตโนมัติ — บล็อกอยู่ที่ต้องรู้ production URL ก่อน (deploy Vercel หรือยัง?)
- **ยังไม่ enqueue "reminder"** (แจ้งเตือนล่วงหน้าก่อนงาน) — ตอนนี้ enqueue แค่ assignment/change/cancellation
- **ไฟล์แนบ**: ยังไม่ทำ (private Storage bucket + signed URL)
- **Display token**: จอมอนิเตอร์ยังเปิดให้ anon เรียก RPC ได้ (ระดับข้อมูลปลอดภัย) — ยังไม่ได้ทำ token gating
- **Export PDF/Excel** ในรายงาน: ยังไม่ทำ
- สร้างบัญชี auth จากในแอป: ยังต้องทำผ่าน Supabase dashboard (service_role key ของโปรเจกต์นี้ใช้ไม่ได้)

## Migrations
`0001` schema · `0002` auth/RLS/views · `0003` monitor feed · `0004` DB hardening (triggers/index/constraints/has_changes) · `0005` accounts · `0006` notifications · `0007` username login · `0008` monitor assignees (ชื่อผู้รับผิดชอบ + เวลาสิ้นสุด ในฟีดจอ) · `0009` notification delivery settings (fallback toggles + same-day reminder flag — **ยังไม่ได้รันบน Supabase จริง**)

## บัญชีทดสอบ
- admin: username `admin`
- assignee ทดสอบ: username `assignee` / รหัส `Assignee123!` (ผูกบุคลากรทดสอบ + มีงานมอบหมาย พิธีกร ในงานพิธีเปิดฯ)

## สื่อตัวอย่าง (demo)
- คลิป GIF จอมอนิเตอร์สำหรับส่งเจ้าหน้าที่ (อยู่ในเครื่อง โฟลเดอร์ Downloads): `pr-os-monitor-tv.gif` (ช่องวาระงาน, ~2.8MB) และ `pr-os-monitor-7channels.gif` (ไล่ครบ 7 ช่อง, ~7.2MB)

## ▶️ รอบถัดไป (เริ่มที่นี่ครั้งหน้า)
ลำดับที่แนะนำเมื่อกลับมาทำต่อ:
1. **Notifications ส่งจริง** — ใส่ credential จริงใน `.env.local` (ดูรายชื่อ env var ในหัวข้อด้านบน), รัน migration `0009` บน Supabase จริง, ทดสอบส่งแบบ end-to-end (queued→sent), เพิ่ม reminder ล่วงหน้า, ตั้ง cron (pg_cron + pg_net หรือ Vercel Cron) ให้เรียก `/api/notifications/process` อัตโนมัติ (ต้องรู้ production URL ก่อน)
2. **ไฟล์แนบ** — private Storage bucket + signed URL (ไม่ให้หลุดบนจอมอนิเตอร์)
3. **Export รายงาน PDF/Excel** ในหน้า `/reports`
4. **Display token** สำหรับจอมอนิเตอร์ (hardening) + ทำให้ราคา/ข่าว/อากาศบนจอเป็นข้อมูลจริง (API) แทน static

## Quality gates (ผ่านล่าสุด)
`npm run build` ✓ · `npm run lint` ✓ · `npm run typecheck` ✓ · RLS verified ผ่าน rolled-back simulations
