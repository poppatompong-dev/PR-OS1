# Notification Design

## สถานะจริงของโค้ด (13 ต.ค. 2026)

ทำแล้ว:

- คิวสร้างอัตโนมัติเมื่อ เผยแพร่ / แก้ไขสำคัญ / ยกเลิก ผ่าน `enqueue_event_notifications()` พร้อมกันซ้ำ
  (รวมการเผยแพร่จากปุ่ม "บันทึกและเผยแพร่" ในฟอร์ม ซึ่งก่อนหน้านี้ไม่สร้างคิวเลย)
- ตัวประมวลผลจริง `processDueNotifications()` (`src/lib/notifications/queue.ts`) — ส่ง LINE ผ่าน Messaging API, อีเมลผ่าน Resend, เช็คโควต้ารายเดือน, fallback ตาม settings, อัปเดตสถานะ `sent`/`failed`/`skipped`
- ก่อนส่งทุกแถวตรวจข้อมูลปัจจุบันซ้ำ (`src/lib/notifications/rules.ts`, มี unit test) — งานถูกยกเลิก/ลบ/เริ่มไปแล้ว,
  ถูกนำออก, แจ้งไม่สะดวก, รับทราบครบแล้ว จะ `skipped` พร้อมเหตุผล
- ผูก LINE เอง: พนักงานกดปุ่มในหน้า `/mobile/my-tasks` แล้วผ่าน LINE Login OAuth (`/api/auth/line/start` → `/callback`) ระบบเขียน `people.line_user_id` ให้
- endpoint ให้ cron เรียก: `POST /api/notifications/process` ตรวจ header `x-notifications-secret`
  ตัวเรียกคือ `.github/workflows/notifications-cron.yml` ทุก 15 นาที (ปิดอยู่จนกว่า owner เปิด — ดู `docs/15`)
- **(0014)** สรุปงานพรุ่งนี้ 17:00, เตือน 1.5 ชม. แบบประหยัดโควต้า, แจ้งหัวหน้าเมื่อมีคนไม่สะดวก/ยังไม่รับทราบ 3 ชม. ก่อนงาน
- **(0014)** แก้บั๊ก `enqueue_event_reminders()` ที่ล้มทุกครั้งตั้งแต่ 0012 — ก่อนหน้านี้ไม่มีการเตือนล่วงหน้าถูกเข้าคิวเลย

ยังไม่ทำ:

- ยังไม่มี credential LINE/Resend บน Vercel จึงยังทำงานโหมดจำลอง (`skipped`) — owner เลือกเลื่อนไปก่อน (2026-10-13)
- `POST /api/notifications/test`, `GET /api/notifications/quota`

## นโยบายโควต้า LINE (owner ตัดสินใจ 2026-10-13)

LINE OA ฟรีในไทยได้ 300 ข้อความ/เดือน (ดู `docs/18`) ถ้าส่งทุกจังหวะต่องาน รองรับได้ราว 40 งาน/เดือน จึงใช้:

| ข้อความ | เมื่อไร | ถึงใคร | ช่องทาง |
|---|---|---|---|
| มอบหมาย / เปลี่ยนแปลง / ยกเลิก | ทันที | ผู้รับงาน | LINE (fallback อีเมล) |
| **สรุปงานพรุ่งนี้** (`digest`) | 17:00 ทุกวัน (`daily_digest_hour`) | ทุกคนที่มีงานพรุ่งนี้ คนละ 1 ข้อความ | LINE (fallback อีเมล) |
| เตือนก่อนงาน (`reminder`) | 1.5 ชม. ก่อนเริ่ม | ผู้รับงาน | LINE เฉพาะคนที่**ยังไม่รับทราบ** · รับทราบแล้วได้ทางอีเมล (ไม่มีอีเมล = ไม่ส่ง) · แจ้งไม่สะดวก = ไม่ส่ง |
| แจ้งไม่สะดวก (`declined`) | ทันทีที่กด | หัวหน้า (supervisor; ไม่มีก็ admin) | LINE (fallback อีเมล) |
| แจ้งหัวหน้า (`escalation`) | 3 ชม. ก่อนเริ่ม (`escalation_hours_before`) | หัวหน้า — ส่งเฉพาะถ้ายังมีคนไม่รับทราบหรือแจ้งไม่สะดวก | LINE (fallback อีเมล) |

เตือนล่วงหน้า 24 ชม. รายงานจะใช้ก็ต่อเมื่อปิดสรุปรายวัน (`daily_digest_enabled = false`)
สรุปรายวันสร้างได้เฉพาะวันเดียวกันหลังเวลาที่ตั้ง — ถ้า cron ล่มทั้งเย็น จะไม่ส่ง "งานพรุ่งนี้" ในเช้าวันรุ่งขึ้น

ข้อจำกัดจากผู้ให้บริการที่ต้องรู้:

- LINE Messaging API **ส่งถึงเฉพาะคนที่เพิ่ม OA เป็นเพื่อนแล้ว** — ถ้ายังไม่แอด จะล้มเหลวแล้วตกไปช่องทางอีเมล
- Resend ที่ยังไม่ verify โดเมน ส่งได้เฉพาะอีเมลของเจ้าของบัญชี

## Channel Strategy

Primary channel: LINE Messaging API for assigned people

Fallback channel: Email

Reasoning:

- LINE is closer to existing user behavior
- Free quota may be enough for pilot if scoped tightly
- Email is easier to keep as fallback and official-friendly

## Free Quota Guard

Design assumptions:

- Count LINE messages by recipient
- Send only to assigned people
- Avoid broadcast to everyone
- One digest per person per day instead of one reminder per job (see นโยบายโควต้า LINE)
- Track monthly usage in `notifications`
- Stop or switch to Email before quota is exceeded

## Notification Types

### Assignment

Sent when event is published and assignee is assigned.

Message should include:

- Event title
- Date/time
- Location
- Role
- Link to acknowledge

### Reminder

Sent before event.

Default timing:

- 1 day before for normal events
- 1 hour before for same-day operational reminder if enabled

### Change

Sent when significant fields change:

- title
- date
- time
- location
- assignee

### Cancellation

Sent when event is canceled.

Must include cancellation reason if safe to share.

## Acknowledgement Flow

Acknowledgement should happen via web, not LINE reply.

Reasons:

- Easier to secure
- Easier to store assignment version
- Avoids depending on LINE webhook complexity in MVP

## Template Examples

### Assignment LINE Template

```text
แจ้งมอบหมายงานประชาสัมพันธ์
งาน: {eventTitle}
วันที่: {eventDate} เวลา {startTime}
สถานที่: {location}
บทบาท: {role}
กรุณากดรับทราบ: {ackUrl}
```

### Change Template

```text
มีการเปลี่ยนแปลงงานประชาสัมพันธ์
งาน: {eventTitle}
เปลี่ยนแปลง: {changeSummary}
กรุณาตรวจสอบและรับทราบใหม่: {ackUrl}
```

### Cancellation Template

```text
ยกเลิกงานประชาสัมพันธ์
งาน: {eventTitle}
วันที่เดิม: {eventDate} เวลา {startTime}
เหตุผล: {cancellationReason}
```

## Queue Rules

- Notification creation and sending are separate steps
- Event mutation creates queued notifications
- Background job sends due notifications
- Failed notification stores error and can be retried
- Duplicate protection uses event, assignment, notification type, and assignment version

## Admin Settings

Recommended settings:

- `line_enabled`
- `email_enabled`
- `line_monthly_quota`
- `default_reminder_hours`
- `same_day_reminder_enabled`
- `fallback_to_email_when_line_fails`
- `fallback_to_email_when_quota_exceeded`
