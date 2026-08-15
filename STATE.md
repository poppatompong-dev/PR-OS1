# STATE.md

Loop state ของ PR-OS — ไฟล์นี้สั้นและอัปเดตบ่อย ใช้ดูว่า "ตอนนี้อยู่ตรงไหน" ก่อนเริ่มงานทุกครั้ง
รายละเอียดเชิงลึกของสิ่งที่ทำเสร็จแล้วทั้งหมดอยู่ที่ `docs/14-implementation-status.md` — ไฟล์นี้ไม่ซ้ำเนื้อหานั้น

อัปเดตล่าสุด: 2026-08-15

## เริ่มตรงนี้ครั้งหน้า

1. **Restore Supabase Project** (ถ้ายัง pause อยู่) และรัน migration `0009`, `0010`, `0011` (Master Data เทศบาลนครนครสวรรค์), และ `0012` (Reminders & Conflict Check)
2. ใส่ Notification Credentials ใน `.env.local` เพื่อเปิดการส่งแจ้งเตือนจริง
3. ทดสอบการใช้งานใน Browser: ปฏิทินรายเดือน/สัปดาห์, การคัดลอกงาน, และการตรวจเตือนเวลาชนกัน

## กำลังทำอยู่

ไม่มีงานค้างกลางทาง — ฟังก์ชันรอบ 2026-08-15 พัฒนาและบิลด์ผ่านสมบูรณ์ทั้งหมด:
- **Dual-tier Reminders**: สร้างคิวเตือนล่วงหน้า 24 ชม. และด่วน 1.5 ชม. ก่อนเริ่มงาน (`0012`, `templates.ts`, `mutations.ts`)
- **Calendar View (`/schedule`)**: เพิ่มปุ่มสลับมุมมอง ตาราง / ปฏิทินรายเดือน / ปฏิทินรายสัปดาห์ (`CalendarMonthView.tsx`, `CalendarWeekView.tsx`)
- **Conflict Soft Warning**: ตรวจจับและแจ้งเตือนเวลาชนกันของเจ้าหน้าที่ (`queries.ts`, `events/[id]/page.tsx`)
- **Duplicate Event**: ปุ่มคัดลอกงานไปยังหน้าสร้างงานใหม่อัตโนมัติ (`events/[id]/page.tsx`, `events/new/page.tsx`)
- **Nakhon Sawan Master Data**: สำนัก/กอง และสถานที่สำคัญจริงของเทศบาลนครนครสวรรค์ (`0011`, `seed.sql`)

`npm run build` ✓ | `npm run typecheck` ✓ (0 errors)

## รออะไรจาก human อยู่

1. **Restore Supabase project** — แผนฟรี pause หลังไม่มี activity 7 วัน ต้องกด Restore ใน Dashboard
2. **รัน migration `0009`, `0010`, `0011`, `0012` ใน SQL Editor**
3. **credential แจ้งเตือน** — `LINE_LOGIN_CHANNEL_ID`/`LINE_LOGIN_CHANNEL_SECRET`/`LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`/`RESEND_API_KEY`/`NOTIFICATIONS_CRON_SECRET`
4. **Production URL** — สำหรับตั้ง cron ยิง `/api/notifications/process` อัตโนมัติ

## Attempt log

- 2026-08-13 — เพิ่ม private attachments + report export xlsx/print + runbook
- 2026-08-15 — เพิ่ม Dual-tier Reminders, Calendar (Month/Week/Table) View, Conflict Soft Warning, Duplicate Event, และ Nakhon Sawan Master Data (`0011`, `0012`) — `npm run build` / `typecheck` ผ่านทั้งหมด ✓
