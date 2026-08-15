# Implementation Plan

## Goal

Build PR-OS from the Phase 0 handoff into a usable MVP with Next.js and Supabase/PostgreSQL.

## Architecture

Use Next.js App Router for UI and server-side operations. Use Supabase for Auth, PostgreSQL, Storage, and RLS. Keep domain logic in small modules so the team can replace Supabase-specific access later if the organization chooses another backend.

## Sprint Status (13 ส.ค. 2569)

| Sprint | สถานะ |
|---|---|
| 1 Project foundation | ✅ เสร็จ |
| 2 Event CRUD | ✅ เสร็จ (รวม significant-change + audit) |
| 3 Assignment & acknowledgement | ✅ เสร็จ |
| 4 Monitor | ✅ เสร็จ (ยังไม่ได้ทำ display token gating) |
| 5 Notifications | 🟡 โค้ดเสร็จ รอ credential + cron + reminder ล่วงหน้า |
| 6 Reports & export | ✅ เสร็จ |
| 7 Attachments (เพิ่มภายหลัง) | ✅ โค้ดเสร็จ รอรัน migration `0010` บน Supabase จริง |

รายละเอียดต่อรายการอยู่ที่ `docs/14-implementation-status.md` · งานที่รอเจ้าของโปรเจกต์อยู่ที่ `docs/15-operations-runbook.md`

## Phase 1 Sprint Plan

### Sprint 1: Project Foundation

Files to create or complete:

- `src/lib/supabase/server.ts`
- `src/lib/supabase/client.ts`
- `src/lib/auth/roles.ts`
- `src/types/domain.ts`
- `supabase/migrations/0001_initial_schema.sql`

Tasks:

- Initialize Supabase project
- Apply initial schema
- Configure Auth
- Add role claims or profile role table
- Implement protected layout
- Implement display-token validation path
- Add seed data from `src/data/mock-data.ts`

Testing:

- Authenticated user can access schedule
- Unauthenticated user is redirected from backend pages
- Display token can access monitor only

### Sprint 2: Event CRUD

Files:

- `src/app/schedule/page.tsx`
- `src/app/events/new/page.tsx`
- `src/app/events/[id]/page.tsx`
- `src/lib/events/queries.ts`
- `src/lib/events/mutations.ts`

Tasks:

- Build event list with filters
- Build create draft form
- Build event detail
- Build publish action
- Build edit action
- Build cancel action with reason
- Write audit logs for create, edit, publish, cancel

Testing:

- Staff can create draft
- Supervisor can publish
- Significant edit writes audit log
- Cancellation keeps event history

### Sprint 3: Assignment And Acknowledgement

Files:

- `src/lib/assignments/queries.ts`
- `src/lib/assignments/mutations.ts`
- `src/app/mobile/my-tasks/page.tsx`
- `src/app/api/assignments/[id]/acknowledge/route.ts`

Tasks:

- Add assignment editor
- Show assignment status on schedule
- Build mobile my-tasks page
- Implement acknowledgement action
- Reset acknowledgement for affected assignees after significant change

Testing:

- Assigned person sees own work only
- Acknowledgement stores assignment version
- Reset occurs only for affected assignments

### Sprint 4: Monitor

Files:

- `src/app/monitor/page.tsx`
- `src/app/api/monitor/events/route.ts`
- `src/lib/monitor/queries.ts`

Tasks:

- Implement monitor-safe query
- Hide private fields
- Add auto refresh
- Add display token check
- Add clear grouping by today/tomorrow/upcoming

Testing:

- Monitor shows published events only
- Draft and private fields are not returned
- Revoked display token cannot access data

### Sprint 5: Notifications

Files:

- `src/lib/notifications/queue.ts`
- `src/lib/notifications/line.ts`
- `src/lib/notifications/email.ts`
- `src/app/api/jobs/send-notifications/route.ts`
- `src/app/settings/page.tsx`

Tasks:

- Create notification queue records
- Implement LINE send adapter
- Implement Email send adapter
- Add quota guard
- Add retry and failure recording
- Add admin test notification

Testing:

- Assignment queues notification
- Change queues change notification
- Quota guard skips LINE when monthly limit reached
- Email fallback is used when LINE is unavailable

### Sprint 6: Reports And Export

Files:

- `src/app/reports/page.tsx`
- `src/lib/reports/queries.ts`
- `src/lib/reports/smart-summary.ts`
- `src/app/api/reports/export/route.ts`

Tasks:

- Build KPI cards
- Build workload summary
- Build unacknowledged report
- Build change/cancellation summary
- Build smart summary text from deterministic rules
- Add PDF/Excel export

Testing:

- Report respects date range filters
- Export matches on-screen filter
- Smart summary text matches calculated data

ผลจริง (13 ส.ค. 2569): Excel ใช้ตัวเขียน `.xlsx` ที่เขียนเองใน `src/lib/export/xlsx.ts` (ZIP + deflate ผ่าน `node:zlib`) ไม่เพิ่ม dependency · PDF ใช้หน้าพิมพ์ `/reports/print` แล้วให้เบราว์เซอร์ Save as PDF แทนการฝัง PDF library (ฟอนต์ไทย) · ทั้งคู่ audit logged

### Sprint 7: Attachments

เพิ่มหลังจากแผนเดิม เพราะ MVP ระบุว่าต้องมีไฟล์แนบแบบส่วนตัว

Files:

- `supabase/migrations/0010_event_attachments.sql`
- `src/lib/attachments/queries.ts`
- `src/lib/attachments/mutations.ts`
- `src/app/api/attachments/[id]/route.ts`

Tasks:

- ตาราง metadata + private bucket + RLS ทั้งสองชั้น
- อัปโหลด/ลบผ่าน server action (backend roles เท่านั้น) + audit
- ดาวน์โหลดผ่าน signed URL อายุสั้นที่สร้างจาก session ผู้เรียกเอง

Testing:

- assignee เห็นเฉพาะไฟล์ของงานตัวเอง
- จอมอนิเตอร์ไม่เห็นไฟล์แนบ
- ลิงก์ดาวน์โหลดหมดอายุตามเวลาที่กำหนด

## Suggested Commit Sequence

1. `docs: add PR-OS phase 0 handoff`
2. `chore: scaffold next app structure`
3. `feat: add initial supabase schema`
4. `feat: implement event schedule`
5. `feat: implement assignments and acknowledgements`
6. `feat: implement monitor feed`
7. `feat: implement notifications`
8. `feat: implement management reports`

## Development Rules

- Start each sprint with database and permission tests
- Avoid business logic hidden only in UI
- Keep audit log creation close to mutations
- Keep notification sending asynchronous
- Never expose private attachments on monitor
- Preserve Thai labels in UI while keeping code names in English
