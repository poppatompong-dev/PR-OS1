# STATE.md

Loop state ของ PR-OS — ไฟล์นี้สั้นและอัปเดตบ่อย ใช้ดูว่า "ตอนนี้อยู่ตรงไหน" ก่อนเริ่มงานทุกครั้ง
รายละเอียดเชิงลึกของสิ่งที่ทำเสร็จแล้วทั้งหมดอยู่ที่ `docs/14-implementation-status.md` — ไฟล์นี้ไม่ซ้ำเนื้อหานั้น

อัปเดตล่าสุด: 2026-08-18 (Security Hardened & Ready for Live DB Execution)

## Production สถานะปัจจุบัน

- **URL:** [https://pr-os1.vercel.app](https://pr-os1.vercel.app/)
- **สถานะ:** READY (Vercel Next.js 15.5.23)
- **โหมดการทำงาน:** Mock Demo Fallback (เปิดอ่านตัวอย่าง ปลอดภัย หน้าไม่ล่ม 500)
- **Font:** Self-hosted (IBM Plex Sans Thai, Space Grotesk, JetBrains Mono)
- **Quality Gates:** `typecheck` ✓ | `build` ✓ | `smoke test (8/8 in mock mode)` ✓
- **DB Security:** `check_staff_conflict()` ใน `0012` และ `combined_0009_to_0012.sql` ได้รับการเสริม Authorization Check (PL/pgSQL) เรียบร้อย

## เริ่มตรงนี้ครั้งหน้า

1. **Restore / เตรียม Supabase Project**
   - ถ้าโปรเจกต์เดิม: รัน `supabase/migrations/combined_0009_to_0012.sql`
   - ถ้าโปรเจกต์ใหม่: รัน `0001` ถึง `0008` ก่อน แล้วจึงรัน `combined_0009_to_0012.sql`
2. **สร้างผู้ใช้และตั้งสิทธิ์ Admin** ผ่าน `public.profiles` (update `role = 'admin'::app_role`)
3. **ใส่ Supabase Credentials บน Vercel** (สำหรับ Production environment) เพื่อเชื่อมต่อฐานข้อมูลจริง
4. **ตั้ง Cron Job** ยิง `POST https://pr-os1.vercel.app/api/notifications/process` พร้อม header `x-notifications-secret: <NOTIFICATIONS_CRON_SECRET>`
5. **ทดสอบ Live Backend Smoke Test** (สร้างงาน, อัปโหลดไฟล์, ตรวจสอบ RLS & Monitor)

## รออะไรจาก human อยู่

1. **Restore / สร้าง Supabase project** — กู้คืนโปรเจกต์หรือสร้างโปรเจกต์ใหม่
2. **รัน migration บน Supabase จริง** ผ่าน SQL Editor
3. **credential Supabase บน Vercel Production** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NOTIFICATIONS_CRON_SECRET`

## Attempt log

- 2026-08-13 — เพิ่ม private attachments + report export xlsx/print + runbook
- 2026-08-15 — เพิ่ม Dual-tier Reminders, Calendar (Month/Week/Table) View, Conflict Soft Warning, Duplicate Event, Nakhon Sawan Master Data (`0011`, `0012`)
- 2026-08-15 — Deploy ขึ้น Production บน Vercel ([pr-os1.vercel.app](https://pr-os1.vercel.app)), ปรับ self-hosted font, เพิ่ม mock fallback ป้องกัน 500, เพิ่ม production regression smoke test (8/8 ผ่าน)
- 2026-08-15 — ทดสอบอัตโนมัติด้วย TestSprite MCP: สร้าง PRD, Code Summary, 15 Test Cases, ทดสอบสำเร็จและบันทึกรายงานสรุปผลที่ `testsprite_tests/testsprite-mcp-test-report.md`
- 2026-08-17 — เพิ่ม PWA Manifest & Icons สำหรับติดตั้งบนมือถือ, เพิ่ม Status Badge บอกสถานะ Mock Mode ใน Sidebar, ตรวจสอบ build/typecheck/smoke test ผ่านทั้งหมด และ Commit & Push เข้าสู่ `origin/main`
- 2026-08-17 — เพิ่ม GitHub Actions CI Workflow (`.github/workflows/ci.yml`) และไฟล์รวม Migration `supabase/migrations/combined_0009_to_0012.sql` สำหรับรันใน Supabase SQL Editor ในคลิกเดียว
- 2026-08-18 — ตรวจสอบและ Hardening `check_staff_conflict()` ป้องกัน unauthorized query ข้ามบุคคล, แก้ไข SOP เป็นลำดับที่ถูกต้องและรัดกุมตามหลัก Least Privilege


