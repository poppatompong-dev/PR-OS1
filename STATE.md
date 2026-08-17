# STATE.md

Loop state ของ PR-OS — ไฟล์นี้สั้นและอัปเดตบ่อย ใช้ดูว่า "ตอนนี้อยู่ตรงไหน" ก่อนเริ่มงานทุกครั้ง
รายละเอียดเชิงลึกของสิ่งที่ทำเสร็จแล้วทั้งหมดอยู่ที่ `docs/14-implementation-status.md` — ไฟล์นี้ไม่ซ้ำเนื้อหานั้น

อัปเดตล่าสุด: 2026-08-15 (Production Deployed)

## Production สถานะปัจจุบัน

- **URL:** [https://pr-os1.vercel.app](https://pr-os1.vercel.app/)
- **สถานะ:** READY (Vercel Next.js 15.5.23)
- **โหมดการทำงาน:** Mock Demo Fallback (เปิดอ่านตัวอย่าง ปลอดภัย หน้าไม่ล่ม 500)
- **Font:** Self-hosted (IBM Plex Sans Thai, Space Grotesk, JetBrains Mono)
- **Quality Gates:** `typecheck` ✓ | `build` ✓ | `smoke test (8/8)` ✓

## เริ่มตรงนี้ครั้งหน้า

1. **Restore Supabase Project** และรัน migration `0009`, `0010`, `0011` (Master Data เทศบาลนครนครสวรรค์), และ `0012` (Reminders & Conflict Check)
2. ใส่ Supabase & Notification Credentials ใน Vercel Environment Variables (`.env.local` / Vercel Dashboard) เพื่อสลับจากโหมด Mock เข้าสู่โหมดฐานข้อมูลจริง
3. ตั้ง Cron Job ยิง `POST https://pr-os1.vercel.app/api/notifications/process` อัตโนมัติ (พร้อม header `Authorization: Bearer <NOTIFICATIONS_CRON_SECRET>`)

## รออะไรจาก human อยู่

1. **Restore Supabase project** — แผนฟรี pause หลังไม่มี activity 7 วัน ต้องกด Restore ใน Dashboard
2. **รัน migration `0009`, `0010`, `0011`, `0012` ใน SQL Editor**
3. **credential แจ้งเตือน & Supabase บน Vercel** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LINE_...`, `RESEND_API_KEY`, `NOTIFICATIONS_CRON_SECRET`

## Attempt log

- 2026-08-13 — เพิ่ม private attachments + report export xlsx/print + runbook
- 2026-08-15 — เพิ่ม Dual-tier Reminders, Calendar (Month/Week/Table) View, Conflict Soft Warning, Duplicate Event, Nakhon Sawan Master Data (`0011`, `0012`)
- 2026-08-15 — Deploy ขึ้น Production บน Vercel ([pr-os1.vercel.app](https://pr-os1.vercel.app)), ปรับ self-hosted font, เพิ่ม mock fallback ป้องกัน 500, เพิ่ม production regression smoke test (8/8 ผ่าน)
- 2026-08-15 — ทดสอบอัตโนมัติด้วย TestSprite MCP: สร้าง PRD, Code Summary, 15 Test Cases, ทดสอบสำเร็จและบันทึกรายงานสรุปผลที่ `testsprite_tests/testsprite-mcp-test-report.md`
- 2026-08-17 — เพิ่ม PWA Manifest & Icons สำหรับติดตั้งบนมือถือ, เพิ่ม Status Badge บอกสถานะ Mock Mode ใน Sidebar, ตรวจสอบ build/typecheck/smoke test ผ่านทั้งหมด และ Commit & Push เข้าสู่ `origin/main`

