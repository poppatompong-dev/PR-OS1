# STATE.md

Loop state ของ PR-OS — ไฟล์นี้สั้นและอัปเดตบ่อย ใช้ดูว่า "ตอนนี้อยู่ตรงไหน" ก่อนเริ่มงานทุกครั้ง
รายละเอียดเชิงลึกของสิ่งที่ทำเสร็จแล้วทั้งหมดอยู่ที่ `docs/14-implementation-status.md` — ไฟล์นี้ไม่ซ้ำเนื้อหานั้น

อัปเดตล่าสุด: 2026-10-13 (ปิดช่องโหว่การทำงานเสร็จบน branch `claude/relaxed-tesla-wn9k2s` — **รัน `0014` บน Supabase จริงก่อน merge**)

## Production สถานะปัจจุบัน

- **URL:** [https://pr-os1.vercel.app](https://pr-os1.vercel.app/)
- **สถานะ:** READY (Vercel Next.js 15.5.23)
- **โหมดการทำงาน:** **Live** — `/api/health` ตอบ `mode: live, database: connected` (keep-alive ผ่านตั้งแต่ 2026-10-12)
  ยังไม่รู้ว่ารัน migration ถึงตัวไหน → ให้ owner รัน `supabase/checks/migration_status.sql` (อ่านอย่างเดียว)
- **Font:** Self-hosted — IBM Plex Sans Thai (หัวเรื่องและเนื้อความ) + JetBrains Mono (ตัวเลข)
  (ถอด Space Grotesk ออกแล้ว: ไม่มีสระ/วรรณยุกต์ไทย หัวเรื่องไทยจึงตกไปใช้ฟอนต์ระบบอยู่ดี)
- **สี:** ม่วงเทศบาลนครนครสวรรค์ `#5e2f73` + Dark mode ฐานม่วงเทา `#1e1a24`
- **อุปกรณ์หลัก:** มือถือ + iPad แนวตั้ง (bottom nav) / เดสก์ท็อปใช้ side rail / จอมอนิเตอร์ไม่แตะ
- **Quality Gates:** `typecheck` ✓ | `lint` ✓ | `test:unit` (14) ✓ | `build` ✓ | `smoke test (12/12 in mock mode)` ✓
- **Keep-alive:** `.github/workflows/keep-alive.yml` เรียก `/api/health` ทุกวัน ไม่ต้องใช้ secret — เขียวเมื่อถึงฐานข้อมูลจริง แดงเมื่อ pause หรือหลุดกลับไปโหมดตัวอย่าง
- **DB Security:** `check_staff_conflict()` ใน `0012` และ `combined_0009_to_0012.sql` ได้รับการเสริม Authorization Check (PL/pgSQL) เรียบร้อย

## UI Redesign (2026-10-10) — เสร็จครบ 4 เฟส

ข้อตกลงก่อนลงมือ: ไม่โละระบบเดิม แก้เฉพาะ UI ไม่แตะ schema / RLS / business logic

| เฟส | สิ่งที่ทำ |
| --- | --- |
| (1) UI | ทุกหน้ารายการใช้งานบนมือถือได้ (ตาราง 6 คอลัมน์ -> การ์ดจัดกลุ่มตามวัน), แถบล่าง 5 ปุ่ม, ฟอร์มเพิ่มงานแบ่ง 4 ขั้นตอน, แนบไฟล์เปิดกล้องได้ทันที |
| (2) หน้าใหม่ | "วันนี้" (แทนหน้า landing เดิม), "งานของฉัน" เข้า AppShell ใช้ได้ทุกอุปกรณ์, "บอร์ดสถานะ" |
| (3) รายงาน | รายเดือน/ไตรมาส/ปี, รายบุคคล (ใช้ประเมินผลงาน), รายกิจกรรม — นับจากข้อมูลเดิม ไม่เพิ่มตาราง |
| (4) ออฟไลน์ | อ่านหน้าที่เคยเปิดได้, กดรับทราบตอนไม่มีสัญญาณแล้วส่งอัตโนมัติเมื่อกลับมาออนไลน์ |

บั๊กที่เจอระหว่างทางและแก้แล้ว (ไม่ใช่เรื่อง UI แต่สำคัญกว่า):

- **วันที่เพี้ยนไป 1 วันบน production** — `Intl.DateTimeFormat` ไม่ได้ระบุ `timeZone` จึงใช้โซนของเครื่อง
  ซึ่งบน Vercel คือ UTC และเที่ยงคืนกรุงเทพ = 17:00 ของเมื่อวานตาม UTC ตอนนี้ตรึงเป็น `Asia/Bangkok` ทุกจุดแล้ว
- **ตัวแปรฟอนต์ใน CSS ไม่เคยถูกประกาศ** (`--font-plex-thai` ฯลฯ) ทำให้ `font-family` ทั้งบรรทัดเป็นโมฆะ
  ระบบจึงแสดงด้วยฟอนต์ default ของเบราว์เซอร์มาตลอด ทั้งที่โหลด IBM Plex ไป 5 น้ำหนัก
- **`prefers-reduced-motion` ล้างแต่ duration ไม่ล้าง delay** ทั้งที่ animation ใช้ `fill-mode: both`
  คนที่ตั้งค่าลดการเคลื่อนไหวจึงเห็นเนื้อหาบางส่วนค้างที่สถานะเริ่มต้น คือมองไม่เห็น

ทดสอบแล้ว: 16 หน้า x ความกว้าง 360/390/820/1024/1440 x light+dark — ไม่มีหน้าไหนล้นจอหรือ error

## ปิดช่องโหว่การทำงาน (2026-10-13) — เสร็จ รอ owner รัน 0014

| เรื่อง | ที่ทำ |
| --- | --- |
| ปุ่ม "ไม่สะดวก" | `/mobile/my-tasks` ใต้ปุ่มรับทราบ ต้องใส่เหตุผล → `decline_assignment()` ติดธงตาม version, ถอนการรับทราบเดิม, audit, แจ้ง supervisor ทันที · หน้างานแสดงเหตุผล · รายงาน/Excel แสดงแค่สถานะ (เหตุผลอาจเป็นข้อมูลส่วนบุคคล) |
| แจ้งหัวหน้า 3 ชม. ก่อนงาน | แถว `escalation` ต่อ supervisor ตอนส่งตรวจซ้ำ ส่งเฉพาะถ้ายังมีคนไม่รับทราบ/ไม่สะดวก พร้อมรายชื่อ |
| สรุปงานพรุ่งนี้ 17:00 | `src/lib/notifications/digest.ts` สร้างแถวคนละ 1 ข้อความ (กันซ้ำด้วย `dedupe_key`) แทนเตือน 24 ชม. |
| เตือน 1.5 ชม. | LINE เฉพาะคนที่ยังไม่รับทราบ · รับทราบแล้ว → อีเมล · ไม่สะดวก → ไม่ส่ง |
| ตรวจก่อนส่ง | `src/lib/notifications/rules.ts` (มี unit test 14 ข้อ) — งานยกเลิก/ลบ/เริ่มแล้ว/ถูกนำออก → `skipped` พร้อมเหตุผล |
| เลขที่หนังสือ / e-Office | ฟอร์มเพิ่ม/แก้ไข + หน้างาน (`source_reference` เดิม + `source_url` ใหม่ รับเฉพาะ http(s)) |
| ตัวเรียกคิว | `.github/workflows/notifications-cron.yml` ทุก 15 นาที **ปิดอยู่** จนกว่าตั้ง secret + ตัวแปร (`docs/15` ข้อ 4) |

บั๊กที่เจอระหว่างทาง (สำคัญ):

- **ช่องโหว่สิทธิ์บน production ตอนนี้** (เจอตอน review): Supabase ให้ anon EXECUTE ทุกฟังก์ชันใหม่ และการเช็ก `role not in (...)` ปล่อย NULL ผ่าน —
  ผู้ไม่ได้ล็อกอินเรียก `process_notification_queue()` ล้างคิวทั้งหมด / `cancel_event_reminders()` / `check_staff_conflict()` ได้ (ทำซ้ำได้บนฐานข้อมูลแบบ Supabase) → 0014 แก้แล้ว **ควรรัน 0014 โดยเร็ว**
- ตัวประมวลผลคิวสองรอบซ้อนกัน (cron + ปุ่ม) เคยส่งแถวเดียวกันซ้ำได้ → จองแถวด้วย `claim_due_notifications()` (SKIP LOCKED) ทดสอบยิงพร้อมกัน 2 รอบ: รอบสองได้ 0 แถว
- โควต้า LINE นับตามเดือนที่เข้าคิว ไม่ใช่เดือนที่ส่ง → นับตามเดือนไทยตอนส่ง

- **`enqueue_event_reminders()` ล้มทุกครั้งตั้งแต่ 0012** (`nullif(jsonb, '')`) แอปไม่ตรวจ error → **ไม่เคยมีการเตือนล่วงหน้าเข้าคิวเลย** แก้ใน 0014 และแอป log error ของ rpc แล้ว
- **"บันทึกและเผยแพร่" จากฟอร์มไม่สร้างคิวแจ้งเตือน** (มีแต่ปุ่มเผยแพร่ในหน้างาน) — แก้แล้ว
- **แก้วัน/เวลางานแล้วเตือนไม่ย้ายตาม** — ตอนนี้ตั้งเวลาใหม่และ skip แถวเก่าพร้อมเหตุผล

ทดสอบแล้ว: 0014 บน Postgres 16 ทั้งแบบธรรมดาและแบบที่ตั้ง default privileges เหมือน Supabase (รันซ้ำได้ + 16 สถานการณ์ รวม RLS ทุก role + anon ถูกปฏิเสธทุกฟังก์ชันที่ไม่ใช่สาธารณะ) · ตัวประมวลผลคิวจริงผ่าน PostgREST 12 (11 แถว ผลตรงทุกแถว, digest ไม่ซ้ำ, secret ผิด → 401) · fallback บนฐานข้อมูลที่ยังไม่มี 0014 · คิวยิงพร้อมกัน 2 รอบไม่ส่งซ้ำ · คิวบนฐานข้อมูลก่อน 0014 ยังทำงาน · unit test 14/14 · typecheck/lint/build · หน้าจอ demo 10 หน้า × มือถือ/iPad/เดสก์ท็อป + dark ไม่มี error/ล้นจอ

## เริ่มตรงนี้ครั้งหน้า

1. **owner รัน `supabase/migrations/0014_workflow_gaps.sql`** ใน SQL Editor แล้วรัน `supabase/checks/migration_status.sql` ซ้ำ (ทุกแถว true) — แล้วค่อย merge branch
   (ถ้า merge ก่อน หน้าเว็บยังทำงานได้ด้วย fallback แต่ปุ่มไม่สะดวกยังใช้ไม่ได้และเตือนยังไม่เข้าคิว)
2. เปิดตัวเรียกคิวตาม `docs/15` ข้อ 4 (ยังโหมดจำลองจนกว่าจะใส่ key LINE/Resend)
3. ทดสอบบน production จริง: กดไม่สะดวกจากบัญชี assignee → หัวหน้าเห็นในหน้างาน + แถว `declined` ใน `/settings`
4. หลังยืนยัน 0014 บน production แล้ว ลบ `PRE_0014_EVENT_SELECT` fallback ใน `src/lib/events/queries.ts` และ `src/lib/assignments/queries.ts`

## ตัดสินใจแล้ว (owner, 2026-10-13)

- **LINE:** สรุปงานของวันพรุ่งนี้ คนละ 1 ข้อความ เวลา 17:00 (แทนเตือน 24 ชม. รายงาน) + เตือน 1.5 ชม. ทาง LINE เฉพาะคนที่ยังไม่รับทราบ ที่เหลือส่ง Email
- **Escalation:** ยังมีคนไม่รับทราบเมื่อเหลือ 3 ชม. ก่อนงาน → แจ้งทุกคนที่เป็น supervisor
- **ปุ่ม "ไม่สะดวก":** ติดธง + เหตุผล แสดงในหน้างาน/รายงาน + แจ้ง supervisor — ไม่ถอดชื่ออัตโนมัติ หัวหน้าเปลี่ยนคนเอง
- **ช่องเลขที่หนังสือ / ลิงก์ e-Office** ในงาน
- **ตัวเรียกคิว:** GitHub Actions ทุก 15 นาที (repo เป็น public จึงไม่เสียนาที) ใช้ repo secret `NOTIFICATIONS_CRON_SECRET`
- **ยังไม่ส่งจริง:** LINE/Resend key ยังไม่ใส่ — สร้างฟีเจอร์ในโหมดจำลอง (คิวขึ้น `skipped`)

## รออะไรจาก human อยู่

1. **ผลของ `supabase/checks/migration_status.sql`** — รู้ว่ารัน migration ถึงตัวไหนแล้ว แล้ว**รัน `0014`** (Human Gate: แก้ schema จริง)
2. **เปิดตัวเรียกคิว** — ตั้ง `NOTIFICATIONS_CRON_SECRET` ใน Vercel + GitHub secret และตัวแปร `NOTIFICATIONS_CRON_ENABLED=true` (Human Gate: scheduled job + secret ใหม่)
3. **ลิงก์ปลายทางของเครื่องมือ 2 ตัวที่ส่งมาเป็น `share.google`** (โดเมนนี้ถูก network policy บล็อก) เพื่อติดตั้งและทดสอบ
4. **key สำหรับส่งจริง** (`LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`, `RESEND_API_KEY`) — เลื่อนไปก่อนตามที่ตกลง

## Attempt log

- 2026-08-13 — เพิ่ม private attachments + report export xlsx/print + runbook
- 2026-08-15 — เพิ่ม Dual-tier Reminders, Calendar (Month/Week/Table) View, Conflict Soft Warning, Duplicate Event, Nakhon Sawan Master Data (`0011`, `0012`)
- 2026-08-15 — Deploy ขึ้น Production บน Vercel ([pr-os1.vercel.app](https://pr-os1.vercel.app)), ปรับ self-hosted font, เพิ่ม mock fallback ป้องกัน 500, เพิ่ม production regression smoke test (8/8 ผ่าน)
- 2026-08-15 — ทดสอบอัตโนมัติด้วย TestSprite MCP: สร้าง PRD, Code Summary, 15 Test Cases, ทดสอบสำเร็จและบันทึกรายงานสรุปผลที่ `testsprite_tests/testsprite-mcp-test-report.md`
- 2026-08-17 — เพิ่ม PWA Manifest & Icons สำหรับติดตั้งบนมือถือ, เพิ่ม Status Badge บอกสถานะ Mock Mode ใน Sidebar, ตรวจสอบ build/typecheck/smoke test ผ่านทั้งหมด และ Commit & Push เข้าสู่ `origin/main`
- 2026-08-17 — เพิ่ม GitHub Actions CI Workflow (`.github/workflows/ci.yml`) และไฟล์รวม Migration `supabase/migrations/combined_0009_to_0012.sql` สำหรับรันใน Supabase SQL Editor ในคลิกเดียว
- 2026-08-18 — ตรวจสอบและ Hardening `check_staff_conflict()` ป้องกัน unauthorized query ข้ามบุคคล, แก้ไข SOP เป็นลำดับที่ถูกต้องและรัดกุมตามหลัก Least Privilege
- 2026-10-10 — UI Redesign ครบ 4 เฟส บน branch `redesign/ui-phase-1` แล้ว merge เข้า `main`:
  ม่วงเทศบาล + dark mode, การ์ดแทนตารางบนมือถือ, บอร์ดสถานะ, ฟอร์ม 4 ขั้นตอน, แนบรูปจากกล้อง,
  รายงาน 3 แบบ, PWA + ออฟไลน์ (service worker + คิวรับทราบใน IndexedDB)
  พร้อมแก้บั๊ก timezone, ตัวแปรฟอนต์ที่ไม่มีอยู่จริง และ reduced-motion
- 2026-10-11 — จอมอนิเตอร์ใหม่ "แบบ 1 · รายการเต็ม" ที่ทีมเลือก (`0013` เพิ่มงานที่ยกเลิก + รายชื่อผู้ยังไม่รับทราบรายคน),
  demo mode แสดงหน้า settings/print ได้, นาฬิกาจอตรึงเวลาไทย; full test pass แก้ PWA ที่โดน login redirect บัง,
  keep-alive ที่ไม่เคย ping จริง (ต้นเหตุ Supabase pause), 5 crash (วันที่ผิดรูปแบบใน URL, การเขียนข้อมูลใน demo mode)
  และ /settings ล้นจอบน iPad แนวตั้ง
- 2026-10-13 — อัปเดต runbook/สถานะให้ครอบคลุม `0011`–`0013` และ keep-alive; ทำ benchmark ระบบใกล้เคียง +
  สำรวจความสามารถด้านสื่อของ Claude → `docs/18-benchmark-and-media-ideas.md`; พบว่า production เชื่อม Supabase จริงแล้ว
- 2026-10-13 — ปิดช่องโหว่การทำงาน (`0014`): ไม่สะดวก, แจ้งหัวหน้า, สรุปพรุ่งนี้ 17:00, เตือน 1.5 ชม. ประหยัดโควต้า,
  เลขที่หนังสือ/e-Office, cron GitHub Actions (ปิดไว้) + แก้บั๊กเตือนล่วงหน้าไม่เคยเข้าคิว


