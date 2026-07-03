# STATE.md

Loop state ของ PR-OS — ไฟล์นี้สั้นและอัปเดตบ่อย ใช้ดูว่า "ตอนนี้อยู่ตรงไหน" ก่อนเริ่มงานทุกครั้ง
รายละเอียดเชิงลึกของสิ่งที่ทำเสร็จแล้วทั้งหมดอยู่ที่ `docs/14-implementation-status.md` — ไฟล์นี้ไม่ซ้ำเนื้อหานั้น

อัปเดตล่าสุด: 2026-07-01 (หยุดพักกลางงาน — ดูหัวข้อ "กำลังทำอยู่" ก่อนเริ่มต่อ)

## กำลังทำอยู่

**งาน #1 ส่งแจ้งเตือนจริง (LINE Login + Messaging API + Resend Email) — ทำไปแล้วประมาณครึ่งทาง หยุดพักไว้**

ตัดสินใจแล้ว (ไม่ต้องถามซ้ำ):
- อีเมล fallback ใช้ **Resend**
- ผูก LINE user id ของพนักงานด้วย **หน้าเว็บ LINE Login (OAuth)** ให้พนักงานกดเชื่อมต่อเอง ไม่ใช้วิธีแอดแอดมินกรอกเอง
- **ยังไม่ตั้ง** scheduled keep-alive loop กัน Supabase pause — เหตุผล: โปรเจกต์ active dev อยู่ทุกวันอยู่แล้ว ไม่จำเป็นตอนนี้ (จะกลับมาตั้งถ้าจะทิ้งโปรเจกต์ไว้เฉยเกิน 7 วันจริง)

ทำเสร็จแล้ว (build ผ่านแล้ว ✓):
- `src/lib/env.ts` — เพิ่ม env vars: `LINE_LOGIN_CHANNEL_ID`, `LINE_LOGIN_CHANNEL_SECRET`, `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NOTIFICATIONS_CRON_SECRET` + helper `isLineLoginConfigured()`/`isLineMessagingConfigured()`/`isEmailConfigured()`
- `supabase/migrations/0009_notification_delivery_settings.sql` — เพิ่ม settings keys: `same_day_reminder_enabled`, `fallback_to_email_when_line_fails`, `fallback_to_email_when_quota_exceeded` (**ยังไม่ได้รันบน Supabase จริง — ต้องรันใน SQL Editor ก่อนใช้งานจริง**)
- `src/lib/notifications/line-login.ts` — LINE Login OAuth: build authorize URL + แลก code เป็น profile
- `src/app/api/auth/line/start/route.ts` + `.../callback/route.ts` — flow ให้ assignee เชื่อมบัญชี LINE เอง (อัปเดต `people.line_user_id` ด้วย admin client เพราะ RLS ให้ admin เขียน people เท่านั้น + เขียน audit log)
- `src/lib/supabase/middleware.ts` — เพิ่ม `/api/notifications/process` เป็น public prefix (cron ไม่มี session cookie ป้องกันด้วย secret header แทน)
- `src/lib/notifications/line.ts` — push message จริงผ่าน LINE Messaging API
- `src/lib/notifications/email.ts` — ส่งอีเมลจริงผ่าน Resend API
- `src/lib/notifications/templates.ts` — ข้อความไทยตาม `docs/09` (assignment/reminder/change/cancellation)
- `src/lib/notifications/queue.ts` — `processDueNotifications()` แกนหลัก: ดึงคิวที่ถึงเวลา, เช็คโควต้า LINE รายเดือน, fallback ไป email ตาม settings, อัปเดตสถานะจริง (ยังคง fallback เป็นโหมดจำลอง `skipped` ถ้าไม่ได้ตั้งค่า provider เลยสักตัว)

**ยังไม่ได้ทำ (ทำต่อตรงนี้พรุ่งนี้):**
1. `src/app/api/notifications/process/route.ts` — endpoint ที่ cron ภายนอกจะเรียก (เช็ค header secret แล้วเรียก `processDueNotifications()`) — ยังไม่ได้สร้างไฟล์
2. `src/lib/settings/mutations.ts` — `processNotificationQueue()` ยังเรียก RPC เก่า (`process_notification_queue` แบบจำลอง) อยู่ **ยังไม่ได้สลับ**ไปเรียก `processDueNotifications()` จริง
3. `src/lib/settings/queries.ts` + `src/app/settings/page.tsx` — ยังไม่เพิ่ม toggle สำหรับ `fallback_to_email_when_line_fails` / `fallback_to_email_when_quota_exceeded` / `same_day_reminder_enabled` และยังไม่แก้ banner ที่บอกว่า "ยังไม่เปิดใช้งาน" ให้เป็นข้อความไดนามิกตามสถานะ config จริง
4. `src/lib/assignments/queries.ts` + `src/app/mobile/my-tasks/page.tsx` — ยังไม่เพิ่มปุ่ม "เชื่อมต่อ LINE" ให้ assignee กด (ตอนนี้มี backend route พร้อมแล้วที่ `/api/auth/line/start` แต่หน้า UI ยังไม่มีปุ่มลิงก์ไปหา)
5. ยังไม่ได้เพิ่มการ enqueue "reminder" (แจ้งเตือนล่วงหน้าก่อนงาน) — ตอนนี้ระบบ enqueue แค่ assignment/change/cancellation เหมือนเดิม
6. ยังไม่ได้เขียน pg_cron migration ให้ยิง `/api/notifications/process` อัตโนมัติ — **บล็อกอยู่ที่ต้องรู้ production URL ก่อน (deploy Vercel หรือยัง?)** ต้องถามเจ้าของโปรเจกต์
7. ยังไม่ได้อัปเดต docs (`docs/09`, `docs/05-api-contract.md`, `docs/14-implementation-status.md`) ให้ตรงกับโค้ดใหม่
8. Task tracker ภายใน session (TaskList #1-8) ยังค้างอยู่ที่ task #5 (in_progress) — ให้ TaskList ดู task ที่เหลือได้เลยตอนกลับมาทำต่อ

## คิวงานถัดไป (เรียงตามลำดับที่ตกลงกันไว้)

1. ⏳ **ส่งแจ้งเตือนจริง** — ดูหัวข้อ "กำลังทำอยู่" ด้านบน (ทำค้างอยู่)
2. ไฟล์แนบ — private Storage bucket + signed URL
3. Export PDF/Excel ในหน้า `/reports`
4. Display token hardening สำหรับ `/monitor` (ตอนนี้ anon เรียก RPC ได้) + ราคาทอง/น้ำมัน/ข่าว/อากาศจริงแทน static data
5. ลบหน้า mock เก่า `/events/sample-event`

## รออะไรจาก human อยู่

- **LINE Login channel ID + Channel secret** (คนละตัวกับ Messaging API) — สร้างที่ LINE Developers Console → ใส่ใน `.env.local` เอง เป็น `LINE_LOGIN_CHANNEL_ID` / `LINE_LOGIN_CHANNEL_SECRET`
- **LINE Messaging API channel access token** — ใส่เป็น `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` ใน `.env.local`
- **Resend API key** — ใส่เป็น `RESEND_API_KEY` (และถ้ามีโดเมนที่ verify แล้วอยากใช้ส่งแทน `onboarding@resend.dev` ให้บอกด้วย จะตั้ง `RESEND_FROM_EMAIL`)
- **Production URL** (deploy Vercel แล้วหรือยัง?) — ต้องรู้ก่อนจะเขียน pg_cron ให้ยิงคิวอัตโนมัติ
- ยืนยันชัดเจนก่อนส่งข้อความจริงออกไปหาผู้ใช้จริงครั้งแรก (ตาม Human Gate ใน `CLAUDE.md`)
- ต้องรัน `supabase/migrations/0009_notification_delivery_settings.sql` บน Supabase จริงก่อนใช้งาน (ยังไม่ได้รัน)

## Attempt log

- 2026-07-01 — เริ่มนำแนวคิด Loop Engineering มาใช้: เพิ่ม Maker→Verify→Checker→Human Gate ลงใน `CLAUDE.md`/`AGENTS.md`, สร้างไฟล์นี้ (`STATE.md`), อัปเดตสถานะ project ใน `CLAUDE.md`/`AGENTS.md` ให้ตรงกับ `docs/14` (เดิมยังเขียนว่า "Phase 0 ยังไม่เชื่อม Supabase" ซึ่งไม่จริงแล้ว)
- 2026-07-01 — เริ่มงาน #1 (ส่งแจ้งเตือนจริง): สร้างไฟล์ตามหัวข้อ "กำลังทำอยู่" ด้านบน, `npm run build` ผ่าน ✓ (ยังไม่ได้ทดสอบส่งจริงเพราะยังไม่มี credential) — หยุดพักตามคำขอผู้ใช้ จะทำต่อเมื่อผู้ใช้พิมพ์กลับมา
- 2026-07-03 — เครื่องนี้มีงานค้างจาก 2026-07-01 ที่ยังไม่เคย commit/push (17 ไฟล์แก้ไข + ไฟล์ใหม่ ~44 ไฟล์ รวม backend integration ทั้งหมด) ตรวจสอบไม่มี secret/ไฟล์ generated หลุดมา, `npm run build` ผ่าน ✓, commit `900239c` แล้ว push ขึ้น `origin/main` สำเร็จ (ก่อนหน้านี้เครื่องนี้ไม่เคยตั้ง git identity เลย ตั้งเป็น `poppatompong-dev` / `poppatompong@gmail.com` แบบ local ต่อ repo นี้ตามที่ผู้ใช้ยืนยัน)

## Scheduled loop

ยังไม่ได้ตั้ง (ตัดสินใจแล้วว่ายังไม่จำเป็นตอนนี้ — ดูหัวข้อ "กำลังทำอยู่") — จะกลับมาพิจารณาถ้ามีช่วงทิ้งโปรเจกต์ไว้เฉยเกิน 7 วันจริง
