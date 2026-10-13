# STATE.md

Loop state ของ PR-OS — ไฟล์นี้สั้นและอัปเดตบ่อย ใช้ดูว่า "ตอนนี้อยู่ตรงไหน" ก่อนเริ่มงานทุกครั้ง
รายละเอียดเชิงลึกของสิ่งที่ทำเสร็จแล้วทั้งหมดอยู่ที่ `docs/14-implementation-status.md` — ไฟล์นี้ไม่ซ้ำเนื้อหานั้น

อัปเดตล่าสุด: 2026-10-13 (Production เชื่อม Supabase จริงแล้ว — รอผลตรวจ migration + ตัดสินใจรอบถัดไปแล้ว ดูหัวข้อ "ตัดสินใจแล้ว")

## Production สถานะปัจจุบัน

- **URL:** [https://pr-os1.vercel.app](https://pr-os1.vercel.app/)
- **สถานะ:** READY (Vercel Next.js 15.5.23)
- **โหมดการทำงาน:** **Live** — `/api/health` ตอบ `mode: live, database: connected` (keep-alive ผ่านตั้งแต่ 2026-10-12)
  ยังไม่รู้ว่ารัน migration ถึงตัวไหน → ให้ owner รัน `supabase/checks/migration_status.sql` (อ่านอย่างเดียว)
- **Font:** Self-hosted — IBM Plex Sans Thai (หัวเรื่องและเนื้อความ) + JetBrains Mono (ตัวเลข)
  (ถอด Space Grotesk ออกแล้ว: ไม่มีสระ/วรรณยุกต์ไทย หัวเรื่องไทยจึงตกไปใช้ฟอนต์ระบบอยู่ดี)
- **สี:** ม่วงเทศบาลนครนครสวรรค์ `#5e2f73` + Dark mode ฐานม่วงเทา `#1e1a24`
- **อุปกรณ์หลัก:** มือถือ + iPad แนวตั้ง (bottom nav) / เดสก์ท็อปใช้ side rail / จอมอนิเตอร์ไม่แตะ
- **Quality Gates:** `typecheck` ✓ | `lint` ✓ | `build` ✓ | `smoke test (12/12 in mock mode)` ✓
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

## เริ่มตรงนี้ครั้งหน้า

1. **ดูผล `supabase/checks/migration_status.sql`** จาก owner — แถวไหน false ให้รันไฟล์นั้น (ดู `docs/15` ข้อ 2)
2. **ปิดช่องโหว่การทำงาน** ตามหัวข้อ "ตัดสินใจแล้ว" ด้านล่าง (ต้องมี migration ใหม่ → owner รันเอง)
3. **ทดสอบ Live Backend Smoke Test** (สร้างงาน, อัปโหลดไฟล์, ตรวจสอบ RLS & Monitor)

## ตัดสินใจแล้ว (owner, 2026-10-13)

- **LINE:** สรุปงานของวันพรุ่งนี้ คนละ 1 ข้อความ เวลา 17:00 (แทนเตือน 24 ชม. รายงาน) + เตือน 1.5 ชม. ทาง LINE เฉพาะคนที่ยังไม่รับทราบ ที่เหลือส่ง Email
- **Escalation:** ยังมีคนไม่รับทราบเมื่อเหลือ 3 ชม. ก่อนงาน → แจ้งทุกคนที่เป็น supervisor
- **ปุ่ม "ไม่สะดวก":** ติดธง + เหตุผล แสดงในหน้างาน/รายงาน + แจ้ง supervisor — ไม่ถอดชื่ออัตโนมัติ หัวหน้าเปลี่ยนคนเอง
- **ช่องเลขที่หนังสือ / ลิงก์ e-Office** ในงาน
- **ตัวเรียกคิว:** GitHub Actions ทุก 15 นาที (repo เป็น public จึงไม่เสียนาที) ใช้ repo secret `NOTIFICATIONS_CRON_SECRET`
- **ยังไม่ส่งจริง:** LINE/Resend key ยังไม่ใส่ — สร้างฟีเจอร์ในโหมดจำลอง (คิวขึ้น `skipped`)

## รออะไรจาก human อยู่

1. **ผลของ `supabase/checks/migration_status.sql`** — รู้ว่ารัน migration ถึงตัวไหนแล้ว
2. **ลิงก์ปลายทางของเครื่องมือ 2 ตัวที่ส่งมาเป็น `share.google`** (โดเมนนี้ถูก network policy บล็อก) เพื่อติดตั้งและทดสอบ
3. **key สำหรับส่งจริง** (`LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`, `RESEND_API_KEY`, `NOTIFICATIONS_CRON_SECRET`) — เลื่อนไปก่อนตามที่ตกลง

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
  สำรวจความสามารถด้านสื่อของ Claude → `docs/18-benchmark-and-media-ideas.md`


