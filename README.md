# PR-OS: ระบบบริหารจัดการงานประชาสัมพันธ์

PR-OS เป็นโครงโปรเจกต์สำหรับส่งต่อโปรแกรมเมอร์เพื่อพัฒนาระบบบริหารจัดการงานประชาสัมพันธ์ของหน่วยงานเทศบาล โดยเน้นการบันทึกงาน กำหนดผู้รับผิดชอบ แสดงตารางงานบนจอมอนิเตอร์ รับทราบงาน แจ้งเตือน และรายงานผู้บริหาร

สถานะของ repository นี้คือ **Phase 0 developer handoff**: มีเอกสารออกแบบ โครงหน้า mock, mock data ภาษาไทย, schema draft และ API contract แต่ยังไม่ใช่ระบบ production และยังไม่เชื่อมต่อ Supabase จริง

## เป้าหมาย

- ให้ฝ่ายประชาสัมพันธ์เห็นงานทั้งหมดจากจุดเดียว แทนการพึ่งกระดานหรือการถามซ้ำ
- ให้ผู้ได้รับมอบหมายรับทราบงานผ่านมือถือหรือเว็บได้
- ให้หัวหน้างานตรวจสอบภาระงาน การเปลี่ยนแปลง และงานที่ยังไม่รับทราบได้รวดเร็ว
- ให้ผู้บริหารมีรายงานสรุปที่อ่านง่าย ส่งออกได้ และตรวจสอบที่มาของข้อมูลได้
- ให้โปรแกรมเมอร์นำโครงนี้ไปพัฒนาต่อด้วย Next.js + Supabase/PostgreSQL ได้ทันที

## Reference Stack

- Frontend: Next.js App Router + TypeScript
- UI: CSS modules/global CSS หรือย้ายไป Tailwind/shadcn ได้ภายหลัง
- Backend reference: Supabase Auth, PostgreSQL, Storage, Row Level Security
- Notification: LINE Messaging API เป็น primary channel พร้อม Email fallback
- Reports: SQL views/materialized views ในช่วงแรก แล้วค่อยเพิ่ม BI หรือ AI ใน Phase 3

## โครงสร้างไฟล์สำคัญ

```text
docs/
  01-vision-and-scope.md
  02-requirements-prd.md
  03-user-flows.md
  04-data-model.md
  05-api-contract.md
  06-ui-screens.md
  07-implementation-plan.md
  08-security-and-permissions.md
  09-notification-design.md
  10-handoff-checklist.md
  11-recommended-skills.md
  12-visual-design-direction.md
src/
  app/                  Next.js mock screens
  components/           Reusable UI components for prototype
  data/mock-data.ts     Thai mock data for prototype and review
  types/domain.ts       Domain types shared by mock screens
supabase/
  migrations/0001_initial_schema.sql
```

## วิธีเริ่มพัฒนาต่อ

1. อ่าน `docs/01-vision-and-scope.md` เพื่อเข้าใจเป้าหมายและ phase
2. อ่าน `docs/02-requirements-prd.md` เพื่อเข้าใจ requirement ที่ตกลงแล้ว
3. ตรวจ `docs/04-data-model.md` และ `supabase/migrations/0001_initial_schema.sql`
4. เปิด prototype mock screens เพื่อคุยกับผู้ใช้ก่อนต่อ backend
5. เริ่ม implement ตาม `docs/07-implementation-plan.md`

## คำสั่งสำหรับโปรแกรมเมอร์

หลังติดตั้ง dependency แล้วสามารถใช้คำสั่งมาตรฐานของ Next.js:

```bash
npm install
npm run dev
npm run lint
npm run typecheck
```

ค่า environment เริ่มจาก `.env.example` แล้วสร้าง `.env.local` ในเครื่องพัฒนา

หมายเหตุสำหรับ dev server: ถ้ารัน `npm run build` ขณะ `npm run dev` ยังเปิดอยู่ ควร restart dev server ก่อนดูหน้าเว็บอีกครั้ง เพราะโฟลเดอร์ `.next` เป็น generated cache และอาจทำให้ CSS dev asset เช่น `/_next/static/css/app/layout.css` ตอบ 404 จนหน้าเว็บกลายเป็น HTML ดิบได้

## ขอบเขตที่ตั้งใจไม่ทำใน MVP

- ไม่ดึงงานจาก LINE group อัตโนมัติ
- ไม่ทำ OCR หนังสือราชการ
- ไม่ทำ AI วิเคราะห์เอกสารหรือเสียงสัมภาษณ์ในระบบจริง
- ไม่ทำ native mobile app
- ไม่เปิดข้อมูลจอมอนิเตอร์เป็น public website
- ไม่ทำ permission ซับซ้อนเกินจำเป็นในรุ่นแรก

## หมายเหตุจากการเก็บ requirement

เอกสารนี้อ้างอิงจากบทสัมภาษณ์และการคุยออกแบบระบบ ณ วันที่ 29 มิถุนายน 2569 โดยมีไฟล์สรุปต้นทางอยู่ที่ `transcripts/interview_summary.md` ควรตรวจทานชื่อบุคคลและคำเฉพาะจากเสียงจริงก่อนนำไปใช้เป็นเอกสารราชการ
