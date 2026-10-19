# Implementation Status

สถานะการพัฒนา PR-OS (อัปเดตต่อเนื่องตามงานจริง) — ล่าสุด 19 ตุลาคม 2569 (ประวัติรายรอบอยู่ใน `STATE.md` หัวข้อ Attempt log)

- **Production URL:** [https://pr-os1.vercel.app](https://pr-os1.vercel.app/) (Vercel Next.js 15.5.23)
- **โหมดปัจจุบัน:** **Live** — ใช้งานจริงกับ Supabase ตั้งแต่ 11 ต.ค. 2569 (mock fallback ยังอยู่ในโค้ดสำหรับพัฒนาในเครื่อง)
- ระบบเชื่อมต่อโค้ด **Supabase จริง** (Auth + PostgreSQL + RLS + SECURITY DEFINER functions) รองรับแผนฟรีทั้งหมด (ดู `docs/13-setup-free-tier.md`)

> ✅ Supabase project `ewwbmqpwxnbfqwpmoomp` ทำงานอยู่ และรัน migration `0001`–`0013` ครบแล้ว (รันมือผ่าน SQL Editor) — **ห้ามใช้ `supabase db push`** ดู `STATE.md` หัวข้อข้อห้าม

## ✅ ทำเสร็จแล้ว (ใช้งานได้จริง)

### Auth & สิทธิ์
- เข้าสู่ระบบด้วย **username/password** (`/login`) — แปลง username → email ฝั่งเซิร์ฟเวอร์ผ่าน `get_login_email()` (อีเมลไม่หลุดไป browser); พิมพ์อีเมลเต็มก็ได้
- Middleware ป้องกัน route ทุกหน้ายกเว้น `/login`, `/monitor`
- Role: `admin / supervisor / staff / assignee / display` + capability checks (`src/lib/auth/roles.ts`)
- RLS เปิดและกำหนด policy ครบทุกตาราง (`0002`) ตรวจสอบแล้ว

### งานประชาสัมพันธ์ (Event lifecycle)
- ตารางงานและปฏิทิน `/schedule` — สลับมุมมอง **ตาราง (Table)**, **ปฏิทินรายเดือน (Month View)**, และ **ปฏิทินรายสัปดาห์ (Week View)** ได้ใน 1 คลิก พร้อมตัวกรอง สถานะ/หน่วยงาน/ค้นหา (server-side)
- เพิ่มงาน `/events/new` — บันทึกร่าง/เผยแพร่ + รองรับ **คัดลอกงาน (Duplicate Event)** ผ่าน `?cloneFrom=<id>` พรีฟิลข้อมูลให้อัตโนมัติ
- รายละเอียดงาน `/events/[id]` — เผยแพร่ / ปิดงาน / ยกเลิก(ต้องมีเหตุผล) / ลบ(soft) / ปุ่มคัดลอกงาน + audit ทุก action
- แก้ไขงาน `/events/[id]/edit` — ตรวจ **significant change** (ชื่อ/วันเวลา/สถานที่) → ตั้ง `has_changes` + **รีเซ็ตการรับทราบ** (bump assignment_version) + audit `significant_change`
- จัดการผู้รับมอบหมายในหน้างาน (เพิ่ม/นำออก) พร้อม **ตรวจจับและแจ้งเตือนเวลาชนกัน (Conflict Soft Warning)**

### มอบหมาย / รับทราบ
- มือถือ `/mobile/my-tasks` — assignee เห็นงานของตน + กด **รับทราบ** จริง (ตาม assignment version ปัจจุบัน)
- RLS: รับทราบได้เฉพาะงานของตัวเอง + version ปัจจุบันเท่านั้น (ตรวจสอบแล้ว)

### จอมอนิเตอร์
- **ค่าเริ่มต้น `/monitor` = ตารางเรียบ อ่านง่าย ตัวใหญ่ พื้นเข้ม** (ตามความเห็นผู้ใช้จริง) — คอลัมน์ วันที่ · เวลา · งาน/กิจกรรม · สถานที่ · ผู้รับผิดชอบ (ชื่อ+บทบาท) · หมายเหตุ; เรียงตามวัน-เวลา; นาฬิกาใหญ่ + auto-refresh 60 วิ (`src/app/monitor/TableMonitor.tsx` + `monitor-table.css`)
- อ่านผ่าน **monitor-safe RPC** `get_monitor_events` (คืนเฉพาะฟิลด์ปลอดภัย: ไม่มีเบอร์โทร/หมายเหตุภายใน/อีเมล/ไฟล์แนบ) — `0008` เพิ่มชื่อผู้รับผิดชอบ + เวลาสิ้นสุด
- **ตัวเลือก `/monitor?classic=1` = จอทีวีย้อนยุค 7 ช่อง** (วาระงาน/ราคาทอง/น้ำมัน/ข่าว/อากาศ/น่าติดตาม/ทีมงาน + มาสคอต) เก็บไว้ตามที่เจ้าของโปรเจกต์ชอบ; จอเต็ม `?classic=1&tv=1`, รีโมท `/monitor/control` (localStorage → production ควรใช้ Supabase Realtime); ราคา/ข่าว/อากาศยังเป็น static ใน `src/lib/signage/data.ts`
- หมายเหตุ: ทิศทาง "ตารางเรียบ" นี้ทับ (supersede) แนวทางลูกเล่นเยอะใน `docs/12` เฉพาะจอมอนิเตอร์

### ไฟล์แนบส่วนตัว
- แถบ "ไฟล์แนบ (ส่วนตัว)" ในหน้า `/events/[id]` — แนบ/ดาวน์โหลด/ลบ พร้อม audit ทุกครั้ง
- เก็บไฟล์ใน **private bucket** `event-attachments` (10 MB/ไฟล์, allowlist PDF/Word/Excel/JPG/PNG/WebP) — migration `0010`
- ดาวน์โหลดผ่าน `/api/attachments/[id]` ที่สร้าง **signed URL อายุ 60 วินาที** จาก session ของผู้เรียกเอง (ไม่ใช้ service role) — RLS จึงเป็นตัวตัดสินสิทธิ์จริง
- สิทธิ์: admin/supervisor/staff แนบ-ลบ-อ่านได้ทั้งหมด · assignee อ่านได้เฉพาะงานที่ตัวเองถูกมอบหมาย · anon/จอมอนิเตอร์ไม่เห็นเลย
- path ใน storage เป็น `'<event_id>/<uuid>.<ext>'` ชื่อไฟล์ผู้ใช้เก็บใน metadata เท่านั้น (กันชื่อไฟล์อันตรายไปเปลี่ยน path)
- ถ้า insert metadata ล้มเหลว ระบบลบ object ทิ้งอัตโนมัติ (ไม่ทิ้ง orphan ใน bucket)
- โค้ด: `src/lib/attachments/{queries,mutations}.ts`, `src/app/api/attachments/[id]/route.ts`

### รายงาน & แดชบอร์ด
- `/reports` — ช่วงวันที่, KPI 6 ตัว, ภาระงานตามบุคคล, รายการค้างรับทราบ, **Smart Summary** แบบกฎคำนวณ
- หน้าแรก `/` — KPI + Smart Summary จากข้อมูลจริง
- **ส่งออก Excel** — ปุ่ม "ดาวน์โหลด Excel" เรียก `GET /api/reports/export?from&to` ได้ไฟล์ `.xlsx` 4 ชีต (สรุป / รายการงาน / ภาระงานตามบุคคล / ค้างรับทราบ)
  - ตัวเขียน xlsx เขียนเองใน `src/lib/export/xlsx.ts` (~230 บรรทัด, ZIP+deflate ผ่าน `node:zlib`, ไม่มี dependency ใหม่)
- **ส่งออก PDF** — หน้า `/reports/print` จัดหน้าสำหรับกระดาษ (ซ่อน chrome, page-break, tabular numbers) สั่งพิมพ์/บันทึกเป็น PDF จากเบราว์เซอร์
- ทั้งสองแบบ **ใช้ตัวกรองเดียวกับที่เห็นบนจอ** และเขียน audit log (`entity_type='report'`, `action='export'`) ทุกครั้ง; ไม่รวมหมายเหตุภายในและไฟล์แนบ

### ตั้งค่า (ผู้ดูแล) `/settings`
- บุคลากร: เพิ่ม / แก้ไข / เปิด-ปิดใช้งาน
- บัญชีผู้ใช้: ตั้ง **username**, role, ผูกกับบุคลากร (กันถอนสิทธิ์ admin ตัวเอง)
- ข้อมูลหลัก: สำนัก/กอง, สถานที่สำคัญจริงของเทศบาลนครนครสวรรค์ (พาสาน, อุทยานสวรรค์, ห้องประชุมสภาฯ ฯลฯ), ประเภทงาน, บทบาท (`0011`)
- การแจ้งเตือน: ตั้งค่า + ดูคิว/ประวัติ + ปุ่มประมวลผลคิว

### การแจ้งเตือน & Reminders (queue)
- สร้างคิวอัตโนมัติเมื่อ เผยแพร่(`assignment`) / แก้ไขสำคัญ(`change`) / ยกเลิก(`cancellation`) ผ่าน `enqueue_event_notifications()` + กันซ้ำ
- **ระบบเตือนล่วงหน้า 2 ระดับ (Dual-tier Reminders)** (`0012`):
  - สร้างคิวเตือนล่วงหน้า 24 ชม. และเตือนด่วน 1.5 ชม. ก่อนเริ่มงานอัตโนมัติเมื่อเผยแพร่งานหรือเพิ่มผู้รับผิดชอบ
  - ยกเลิกคิวเตือนอัตโนมัติเมื่อยกเลิกงาน (`cancel_event_reminders`)
- ตัวประมวลผลจริง `processDueNotifications()` (`src/lib/notifications/queue.ts`) — ดึงคิวที่ถึงเวลา, ส่ง LINE ผ่าน Messaging API / Email ผ่าน Resend, เช็คโควต้า LINE รายเดือน, fallback ไป email ตาม settings

## ⚠️ ยังเหลือ / ข้อจำกัด
- **LINE bot — โค้ดเสร็จ รอเปิดใช้**: ต้องรัน `0014_line_bot.sql` ก่อน push แล้วสร้าง OA + ใส่ 4 ตัวแปรบน Vercel (`docs/15` ข้อ 8)
  ก่อนมี credential คิวจะถูก mark `skipped` (โหมดจำลอง) ตามเดิม · ยังไม่ได้ทดสอบกับ LINE จริง
- **อีเมล (Resend) ไม่ใช้** — owner เลือกไม่ใช้อีเมลสำรอง โค้ดส่งอีเมลถูกถอดออกแล้ว (19 ต.ค.)
- **ตัวตั้งเวลาเรียก `/api/notifications/process`** — มี `.github/workflows/notifications.yml` แล้ว (ทุก 15 นาที 06:00–20:00) รอ owner ใส่ secret `NOTIFICATIONS_CRON_SECRET` ใน GitHub
- **สำรองข้อมูล** — มี `.github/workflows/db-backup.yml` แล้ว (รายสัปดาห์ เข้ารหัส) รอ owner ใส่ `SUPABASE_DB_URL` + `BACKUP_PASSPHRASE`
  ไฟล์แนบใน Storage **ไม่ได้** อยู่ในไฟล์สำรอง (สำรองเฉพาะฐานข้อมูล)
- **keep-alive** (`.github/workflows/keep-alive.yml`) ต้องเขียวทุกวัน ถ้าแดง = Supabase หลับหรือ Vercel หลุดจากฐานข้อมูล

## Migrations
`0001` schema · `0002` auth/RLS/views · `0003` monitor feed · `0004` DB hardening · `0005` accounts · `0006` notifications · `0007` username login · `0008` monitor assignees · `0009` notification delivery settings · `0010` event attachments · `0011` nakhon sawan master data · `0012` reminders & conflict check · `0013` monitor board (status/การยกเลิก/ผู้รับทราบรายคน) · `0014` LINE bot (**ยังไม่ได้รันบน production**)

## Quality gates (ผ่านล่าสุด 13 ต.ค. 2569)
`npm run build` ✓ · `npm run typecheck` ✓ · `npm run lint` ✓ · smoke test 12/12 (mock mode)
