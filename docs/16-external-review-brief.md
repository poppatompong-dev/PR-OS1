# External Review Brief — PR-OS

เอกสารนี้เขียนสำหรับ **ที่ปรึกษา/ผู้ตรวจจากภายนอก** ที่เพิ่งได้รับสิทธิ์เข้าถึงโฟลเดอร์โปรเจกต์ และต้องการเข้าใจระบบให้เร็วที่สุดเพื่อให้คำแนะนำได้ตรงจุด
อัปเดตล่าสุด: 13 สิงหาคม 2569

---

## 1. โปรเจกต์นี้คืออะไร

PR-OS = ระบบบริหารงานประชาสัมพันธ์ของหน่วยงานเทศบาล ทดแทนกระบวนการเดิมที่งานเข้ามาหลายช่องทาง (LINE, โทรศัพท์, หนังสือราชการ, เดินมาบอก) แล้วจดบนกระดานไวท์บอร์ด

ผลลัพธ์ที่ต้องการ:

1. แหล่งข้อมูลงานเดียวที่เชื่อถือได้
2. มอบหมายงานชัดเจนเป็นรายคน/บทบาท
3. ผู้รับมอบหมายกดรับทราบผ่านมือถือได้
4. จอมอนิเตอร์ในสำนักงานแสดงตารางงานโดยไม่หลุดข้อมูลภายใน
5. รายงานผู้บริหารที่ตรวจสอบที่มาได้ + ส่งออกได้

ผู้ใช้จริงเป็นทีมเล็ก (บุคลากรตั้งต้น 6 คน) ระบบทำงานบน **แผนฟรีทั้งหมด** (Supabase Free + Next.js) ข้อจำกัดด้านต้นทุนจึงเป็นเงื่อนไขออกแบบ ไม่ใช่แค่ความชอบ

## 2. สแตกและสถาปัตยกรรม

| ชั้น | ของจริงที่ใช้ |
|---|---|
| Framework | Next.js App Router (v15) + React 19 + TypeScript |
| Data | Supabase: Postgres + Auth + Storage, RLS เปิดทุกตาราง |
| การเขียนข้อมูล | Server Actions / Route Handlers เท่านั้น (ไม่มี business logic ใน client) |
| สิทธิ์ | role: admin / supervisor / staff / assignee / display + capability helper `src/lib/auth/roles.ts` — โดย **RLS ใน Postgres คือ source of truth** ส่วน helper ใช้ให้ UI สอดคล้องกัน |
| UI | global CSS เดียว (`src/app/globals.css`) ไม่ใช้ CSS framework, ไอคอน lucide-react |
| Dependencies | ตั้งใจให้น้อยมาก — ทั้งโปรเจกต์มี runtime dependency 5 ตัว (supabase 2, next, react, react-dom, lucide-react) |

โครงโดเมนโมดูลอยู่ใต้ `src/lib/<domain>/` แยก `queries.ts` (อ่าน) กับ `mutations.ts` (เขียน) เช่น `events`, `assignments`, `attachments`, `notifications`, `reports`, `settings`, `monitor`

## 3. เส้นทางในระบบ (routes)

| Route | หน้าที่ |
|---|---|
| `/` | แดชบอร์ด KPI + Smart Summary |
| `/login` | เข้าสู่ระบบด้วย username (แปลงเป็นอีเมลฝั่งเซิร์ฟเวอร์ผ่าน RPC) |
| `/schedule` | ตารางงาน + ตัวกรอง (server-side) |
| `/events/new`, `/events/[id]`, `/events/[id]/edit` | วงจรชีวิตงาน + audit + ไฟล์แนบ |
| `/mobile/my-tasks` | มุมมองมือถือของผู้รับมอบหมาย + กดรับทราบ + ปุ่มเชื่อมต่อ LINE |
| `/monitor` | จอสำนักงาน (public, monitor-safe) — ตารางเรียบตัวใหญ่; `?classic=1` คือจอทีวี 7 ช่อง |
| `/reports`, `/reports/print` | รายงานผู้บริหาร + ส่งออก Excel/PDF |
| `/settings` | คอนโซลผู้ดูแล: บุคลากร บัญชี ข้อมูลหลัก การแจ้งเตือน |
| `/api/attachments/[id]` | redirect ไป signed URL อายุ 60 วินาที |
| `/api/reports/export` | ไฟล์ `.xlsx` |
| `/api/notifications/process` | ให้ cron ภายนอกเรียก (ตรวจ shared secret) |
| `/api/auth/line/start`, `/callback` | LINE Login OAuth เพื่อผูก line_user_id ของพนักงานเอง |

## 4. กติกาที่ห้ามละเมิด (ถ้าจะเสนอแนวทางใหม่)

- **จอมอนิเตอร์ต้องปลอดภัยเสมอ** — อ่านผ่าน SECURITY DEFINER RPC `get_monitor_events()` ที่คืนเฉพาะฟิลด์ปลอดภัย ห้ามให้เบอร์โทร/หมายเหตุภายใน/ไฟล์แนบหลุดออกจอ
- **audit log เป็น append-only** ไม่มี policy update/delete
- **ไม่ลบข้อมูลปฏิบัติการจริง** ใช้ soft delete
- **secret อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น**
- **การรับทราบผูกกับเวอร์ชันของ assignment** — แก้ไขฟิลด์สำคัญ (ชื่อ/วัน/เวลา/สถานที่) ของงานที่เผยแพร่แล้วจะ bump `assignment_version` ทำให้การรับทราบเดิมกลายเป็น "รอรับทราบ" อัตโนมัติ
- **UI ต้องอ่านออกในระยะไกล** ตัวอักษรไทยใหญ่ ตัวเลขใช้ tabular numerals
- ผู้ใช้จริงบอกชัดว่าอยากได้ **จอมอนิเตอร์แบบตารางเรียบ ๆ อ่านง่าย** ไม่เอาลูกเล่นเยอะ

## 5. สถานะปัจจุบัน (สรุปสั้น)

ใช้งานได้จริงแล้ว: auth, วงจรชีวิตงาน + audit, มอบหมาย/รับทราบ, จอมอนิเตอร์, รายงาน + ส่งออก Excel/PDF, ไฟล์แนบส่วนตัว, หน้าตั้งค่า, คิวแจ้งเตือน

ยังค้าง (ทั้งหมดติดที่ต้องมี credential/การตัดสินใจจากเจ้าของโปรเจกต์ ไม่ได้ติดที่โค้ด):

1. Supabase project ถูก pause (แผนฟรี) ต้อง restore ก่อน — `docs/15-operations-runbook.md`
2. migration `0009`, `0010` ยังไม่ได้รันบน Supabase จริง
3. ส่งแจ้งเตือนจริงยังปิดอยู่ (ยังไม่ใส่ LINE/Resend credential) — โค้ดพร้อมแล้ว
4. ยังไม่มี reminder ล่วงหน้าก่อนงาน และยังไม่ได้ตั้ง cron (รอ production URL)
5. จอมอนิเตอร์ยังไม่ได้ทำ display token gating — ตอนนี้ผู้ถือ anon key เรียก RPC ที่ปลอดภัยได้
6. ราคาทอง/น้ำมัน/ข่าว/อากาศบนจอทีวีย้อนยุคยังเป็นข้อมูล static

รายละเอียดเต็มอยู่ที่ `docs/14-implementation-status.md` และสถานะรอบล่าสุดที่ `STATE.md`

## 6. อยากได้คำแนะนำเรื่องไหนเป็นพิเศษ

1. **Deploy & ต้นทุน** — ควรขึ้น Vercel free หรือทางอื่น? จะกัน Supabase free pause ยังไงให้ไม่ต้องคอยเข้าไปดูเอง?
2. **โมเดลแจ้งเตือน** — LINE Messaging API ฟรีมีโควต้าจำกัด ควรใช้ LINE Notify/กลุ่ม/อีเมลผสมยังไงให้คุ้ม และควรเตือนล่วงหน้ากี่ชั่วโมง
3. **display token** สำหรับจอมอนิเตอร์ — คุ้มไหมกับความเสี่ยงจริงในสำนักงาน หรือแค่จำกัดที่เครือข่ายพอ
4. **ความพร้อมใช้จริงกับผู้ใช้ 6 คน** — flow ไหนที่จะทำให้เจ้าหน้าที่เลิกใช้ภายในสองสัปดาห์
5. **Backup/restore** — ตอนนี้ยังพึ่ง Supabase free backup อย่างเดียว
6. **โครงสร้างโค้ด** — โดเมนโมดูลแบบ queries/mutations เหมาะจะโตต่อไหม หรือควรมี service layer

## 7. วิธีอ่านโค้ดให้เร็ว

```text
CLAUDE.md / AGENTS.md            กติกาโปรเจกต์ทั้งหมด (ยาวแต่ครบ)
STATE.md                         สถานะล่าสุด + ติดอะไรอยู่
docs/14-implementation-status.md ทำอะไรไปแล้วบ้าง
docs/04-data-model.md            โครงข้อมูล
docs/08-security-and-permissions.md  โมเดลสิทธิ์
supabase/migrations/             ของจริงของฐานข้อมูล อ่านเรียง 0001 → 0010
src/lib/                         ตรรกะโดเมนทั้งหมด
```

รันในเครื่อง:

```bash
npm install
npm run dev      # ต้องมี .env.local ที่ชี้ Supabase ที่ยัง active
npm run build && npm run typecheck && npm run lint
```

## 8. ข้อควรระวังเรื่องความปลอดภัยตอนแชร์โฟลเดอร์

- ไฟล์ `.env.local` (ไม่ถูก commit เข้า git) มี **Supabase URL + anon key + service role key จริง** — service role bypass RLS ทั้งหมด ถ้าไม่จำเป็นอย่าเปิดไฟล์นี้ และอย่าคัดลอกออกนอกเครื่อง
- ถ้าคีย์ถูกเปิดเผยแล้ว เจ้าของโปรเจกต์ควร rotate ที่ Supabase dashboard → Settings → API
- ห้ามส่งข้อความ LINE/อีเมลจริงหาผู้ใช้จริงระหว่างทดสอบ — ระบบมี Human Gate ระบุไว้ใน `CLAUDE.md`
- ข้อมูลบุคลากรในระบบเป็นชื่อจริงของเจ้าหน้าที่ ไม่ควรคัดลอกออกนอกโปรเจกต์
