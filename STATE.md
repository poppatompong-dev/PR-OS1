# STATE.md

Loop state ของ PR-OS — ไฟล์นี้สั้นและอัปเดตบ่อย ใช้ดูว่า "ตอนนี้อยู่ตรงไหน" ก่อนเริ่มงานทุกครั้ง
รายละเอียดเชิงลึกของสิ่งที่ทำเสร็จแล้วทั้งหมดอยู่ที่ `docs/14-implementation-status.md` — ไฟล์นี้ไม่ซ้ำเนื้อหานั้น

อัปเดตล่าสุด: 2026-07-03

## กำลังทำอยู่

**งาน #1 ส่งแจ้งเตือนจริง (LINE Login + Messaging API + Resend Email) — โค้ดฝั่งแอปเสร็จหมดแล้ว เหลือแค่รอ credential/production URL จาก human**

ตัดสินใจแล้ว (ไม่ต้องถามซ้ำ):
- อีเมล fallback ใช้ **Resend**
- ผูก LINE user id ของพนักงานด้วย **หน้าเว็บ LINE Login (OAuth)** ให้พนักงานกดเชื่อมต่อเอง ไม่ใช้วิธีแอดแอดมินกรอกเอง
- **ยังไม่ตั้ง** scheduled keep-alive loop กัน Supabase pause — เหตุผล: โปรเจกต์ active dev อยู่ทุกวันอยู่แล้ว ไม่จำเป็นตอนนี้ (จะกลับมาตั้งถ้าจะทิ้งโปรเจกต์ไว้เฉยเกิน 7 วันจริง)

ทำเสร็จแล้ว (build ผ่านแล้ว ✓):
- `src/lib/env.ts`, `src/lib/notifications/{line-login,line,email,templates,queue}.ts`, `src/app/api/auth/line/{start,callback}/route.ts`, `src/lib/supabase/middleware.ts` — ตามที่บันทึกไว้ก่อนหน้า (LINE Login OAuth, push จริง, email จริงผ่าน Resend, ตัวประมวลผลคิวหลัก)
- `src/app/api/notifications/process/route.ts` — endpoint ให้ cron ภายนอกเรียก (เช็ค header `x-notifications-secret` เทียบ `NOTIFICATIONS_CRON_SECRET` แล้วเรียก `processDueNotifications()`)
- `src/lib/settings/mutations.ts` — `processNotificationQueue()` เลิกเรียก RPC จำลองแล้ว สลับไปเรียก `processDueNotifications()` จริง + แสดงสรุปผล (ส่งแล้ว/ล้มเหลว/ข้าม) เป็น notice banner สีเขียวในหน้า settings
- `src/lib/settings/queries.ts` + `src/app/settings/page.tsx` — เพิ่ม toggle `same_day_reminder_enabled` / `fallback_to_email_when_line_fails` / `fallback_to_email_when_quota_exceeded` แล้ว + banner บนหัวข้อแจ้งเตือนเปลี่ยนเป็นไดนามิกตาม `isLineMessagingConfigured()`/`isEmailConfigured()` จริง (เขียว = เชื่อมต่อแล้ว, เหลือง = ยังโหมดจำลอง)
- `src/lib/assignments/queries.ts` + `src/app/mobile/my-tasks/page.tsx` — เพิ่มปุ่ม "เชื่อมต่อ LINE" (ลิงก์ไป `/api/auth/line/start`) แสดงเมื่อผูกบุคลากรแล้วแต่ยังไม่ผูก LINE และระบบตั้งค่า LINE Login ไว้แล้ว + banner แจ้งเชื่อมต่อสำเร็จเมื่อ redirect กลับมาด้วย `?line=linked`
- ลบหน้า mock เก่า `/events/sample-event` แล้ว (อัปเดต route list ใน `CLAUDE.md`/`AGENTS.md`/`docs/06-ui-screens.md` ตามด้วย)
- อัปเดต `docs/14-implementation-status.md` และ `docs/05-api-contract.md` ให้ตรงกับโค้ดจริงแล้ว

**ยังไม่ได้ทำ (ต้องรอ credential/decision จาก human ก่อนถึงจะทำต่อได้จริง):**
1. ยัง**ไม่มี credential จริง** ใน `.env.local` เลย (LINE Login/Messaging/Resend) — โค้ดพร้อมส่งจริงแล้วแต่ยังทำงานโหมดจำลอง (`skipped`) อยู่จนกว่าจะใส่ค่า
2. `supabase/migrations/0009_notification_delivery_settings.sql` **ยังไม่ได้รันบน Supabase จริง**
3. ยังไม่ได้เพิ่มการ enqueue "reminder" (แจ้งเตือนล่วงหน้าก่อนงาน) — ตอนนี้ enqueue แค่ assignment/change/cancellation, toggle `sameDayReminderEnabled` ในหน้า settings **บันทึกค่าได้แต่ยังไม่มีผลจริง** เพราะยังไม่มีตัว enqueue reminder
4. ยังไม่ได้เขียน pg_cron migration ให้ยิง `/api/notifications/process` อัตโนมัติ — **บล็อกอยู่ที่ต้องรู้ production URL ก่อน**

## คิวงานถัดไป (เรียงตามลำดับที่ตกลงกันไว้)

1. ⏳ **ส่งแจ้งเตือนจริง** — รอ credential จาก human ก่อน (ดูหัวข้อ "รออะไรจาก human อยู่")
2. ไฟล์แนบ — private Storage bucket + signed URL
3. Export PDF/Excel ในหน้า `/reports`
4. Display token hardening สำหรับ `/monitor` (ตอนนี้ anon เรียก RPC ได้) + ราคาทอง/น้ำมัน/ข่าว/อากาศจริงแทน static data

## รออะไรจาก human อยู่

- **LINE Login channel ID + Channel secret** (คนละตัวกับ Messaging API) — สร้างที่ LINE Developers Console → ใส่ใน `.env.local` เอง เป็น `LINE_LOGIN_CHANNEL_ID` / `LINE_LOGIN_CHANNEL_SECRET`
- **LINE Messaging API channel access token** — ใส่เป็น `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` ใน `.env.local`
- **Resend API key** — ใส่เป็น `RESEND_API_KEY` (และถ้ามีโดเมนที่ verify แล้วอยากใช้ส่งแทน `onboarding@resend.dev` ให้บอกด้วย จะตั้ง `RESEND_FROM_EMAIL`)
- **Production URL** (deploy Vercel แล้วหรือยัง?) — ต้องรู้ก่อนจะเขียน pg_cron ให้ยิงคิวอัตโนมัติ
- ยืนยันชัดเจนก่อนส่งข้อความจริงออกไปหาผู้ใช้จริงครั้งแรก (ตาม Human Gate ใน `CLAUDE.md`)
- ต้องรัน `supabase/migrations/0009_notification_delivery_settings.sql` บน Supabase จริงก่อนใช้งาน (ยังไม่ได้รัน — เป็น Human Gate เพราะกระทบ schema project จริง)

## Attempt log

- 2026-07-01 — เริ่มนำแนวคิด Loop Engineering มาใช้: เพิ่ม Maker→Verify→Checker→Human Gate ลงใน `CLAUDE.md`/`AGENTS.md`, สร้างไฟล์นี้ (`STATE.md`), อัปเดตสถานะ project ใน `CLAUDE.md`/`AGENTS.md` ให้ตรงกับ `docs/14` (เดิมยังเขียนว่า "Phase 0 ยังไม่เชื่อม Supabase" ซึ่งไม่จริงแล้ว)
- 2026-07-01 — เริ่มงาน #1 (ส่งแจ้งเตือนจริง): สร้างไฟล์ตามหัวข้อ "กำลังทำอยู่" ด้านบน, `npm run build` ผ่าน ✓ (ยังไม่ได้ทดสอบส่งจริงเพราะยังไม่มี credential) — หยุดพักตามคำขอผู้ใช้ จะทำต่อเมื่อผู้ใช้พิมพ์กลับมา
- 2026-07-03 — เครื่องนี้มีงานค้างจาก 2026-07-01 ที่ยังไม่เคย commit/push (17 ไฟล์แก้ไข + ไฟล์ใหม่ ~44 ไฟล์ รวม backend integration ทั้งหมด) ตรวจสอบไม่มี secret/ไฟล์ generated หลุดมา, `npm run build` ผ่าน ✓, commit `900239c` แล้ว push ขึ้น `origin/main` สำเร็จ (ก่อนหน้านี้เครื่องนี้ไม่เคยตั้ง git identity เลย ตั้งเป็น `poppatompong-dev` / `poppatompong@gmail.com` แบบ local ต่อ repo นี้ตามที่ผู้ใช้ยืนยัน)
- 2026-07-03 — ทำงาน #1 (ส่งแจ้งเตือนจริง) ต่อจนจบทุกส่วนที่ไม่ต้องรอ credential/production URL/Supabase migration จริง: สร้าง `/api/notifications/process` endpoint, สลับปุ่ม "ประมวลผลคิว" ไปเรียกตัวส่งจริง, เพิ่ม toggle fallback 3 ตัวในหน้า settings, เพิ่มปุ่ม "เชื่อมต่อ LINE" ในมือถือ, ลบหน้า mock `/events/sample-event`, อัปเดตเอกสารที่เกี่ยวข้องทั้งหมด — `npm run build` ผ่าน ✓ ทุกจุด Human Gate ที่เหลือ (ส่งข้อความจริง/รัน migration บน Supabase จริง/รู้ production URL) ยังไม่แตะ

## Scheduled loop

ยังไม่ได้ตั้ง (ตัดสินใจแล้วว่ายังไม่จำเป็นตอนนี้ — ดูหัวข้อ "กำลังทำอยู่") — จะกลับมาพิจารณาถ้ามีช่วงทิ้งโปรเจกต์ไว้เฉยเกิน 7 วันจริง
