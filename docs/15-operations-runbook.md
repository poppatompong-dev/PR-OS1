# Operations Runbook

คู่มือปฏิบัติการสำหรับเจ้าของโปรเจกต์ (ไม่ใช่ agent) — งานที่ต้องทำเองบน Supabase / เครื่อง production
อัปเดตล่าสุด: 13 สิงหาคม 2569

รายการในไฟล์นี้อยู่หลัง **Human Gate** ตาม `CLAUDE.md` คือ agent เตรียม SQL/โค้ดให้ได้ แต่ไม่รันให้เอง เพราะกระทบ project จริง/ข้อมูลจริง/ส่งข้อความจริง

มีเวอร์ชันหน้าเว็บสำหรับส่งต่อให้ผู้ช่วยลงมือทำ (เนื้อหาเดียวกัน เรียงเป็นงาน 1–10 พร้อมช่องตรวจสอบ):
<https://claude.ai/code/artifact/4a3ea6b6-5794-448d-9d71-1565b278489b>

---

## 1. Supabase project ถูก pause (ต้องกู้คืนก่อนใช้งาน)

**อาการที่ตรวจพบ 13 ส.ค. 2569:** โฮสต์ของโปรเจกต์ resolve ไม่ได้เลย

```text
nslookup ewwbmqpwxnbfqwpmoomp.supabase.co 8.8.8.8
*** dns.google can't find ewwbmqpwxnbfqwpmoomp.supabase.co: Non-existent domain
```

Supabase แผนฟรีจะ pause โปรเจกต์ที่ไม่มี activity เกิน 7 วัน (commit ล่าสุดของ repo คือ 3 ก.ค. 2569 — ห่างกว่า 6 สัปดาห์) เมื่อ pause แล้ว DNS ของ project host จะหายไป ทุกหน้าที่อ่านข้อมูลจึงพังหมด

**วิธีกู้คืน**

1. เข้า https://supabase.com/dashboard → เลือกโปรเจกต์ PR-OS (ref `ewwbmqpwxnbfqwpmoomp`)
2. กด **Restore project** แล้วรอจนสถานะเป็น Active (ปกติไม่กี่นาที)
3. ตรวจว่ากลับมาแล้ว:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>" \
  "https://ewwbmqpwxnbfqwpmoomp.supabase.co/rest/v1/"
# คาดหวัง 200
```

4. ถ้า restore ไม่ขึ้น/โปรเจกต์หายไปแล้ว ให้สร้างโปรเจกต์ใหม่ แล้วรัน migration `0001` → `0010` ตามลำดับ + `supabase/seed.sql` และอัปเดต URL/anon key ใน `.env.local`

**กัน pause ซ้ำ:** ถ้าจะเว้นช่วงไม่แตะโปรเจกต์เกิน 7 วัน ให้ตั้ง cron ภายนอก (เช่น GitHub Actions / cron-job.org) ยิง REST ping สัปดาห์ละครั้ง หรือเข้า dashboard สัปดาห์ละครั้ง

---

## 2. Migration ที่ยังไม่ได้รันบน Supabase จริง

รันใน **SQL Editor** ของ dashboard ตามลำดับ (คัดลอกทั้งไฟล์ วางแล้วกด Run)

| ไฟล์ | ทำอะไร | หมายเหตุ |
|---|---|---|
| `supabase/migrations/0009_notification_delivery_settings.sql` | เพิ่ม settings 3 คีย์ (reminder วันเดียวกัน, fallback อีเมลเมื่อ LINE ล้มเหลว/โควต้าเต็ม) | ไม่รันแล้ว toggle ในหน้า `/settings` จะบันทึกไม่ได้ |
| `supabase/migrations/0010_event_attachments.sql` | ตาราง `event_attachments` + bucket `event-attachments` (private) + RLS ทั้ง table และ storage | ไม่รันแล้วแถบไฟล์แนบในหน้างานจะ error |

ถ้ารัน `0010` แล้วเจอ `permission denied for table objects` (บางโปรเจกต์จำกัดสิทธิ์ schema `storage`) ให้ทำสองส่วนแยกกัน: ส่วนตาราง/bucket รันใน SQL Editor ตามปกติ ส่วน policy ของ storage สร้างผ่าน dashboard → Storage → bucket `event-attachments` → Policies โดยใช้เงื่อนไขเดียวกับในไฟล์ migration

**ตรวจหลังรัน 0010**

```sql
-- bucket ต้อง private
select id, public, file_size_limit from storage.buckets where id = 'event-attachments';

-- ต้องเห็น 3 policy ของ storage
select policyname from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname like 'event_attachments%';

-- ต้องเห็น 2 policy ของ table
select policyname from pg_policies
where schemaname = 'public' and tablename = 'event_attachments';
```

**ทดสอบด้วยมือ (หลัง restore + รัน migration)**

1. ล็อกอินเป็น `admin` → เปิดงานสักงาน → แนบไฟล์ PDF → ต้องเห็นชื่อไฟล์ + ขนาด
2. กดชื่อไฟล์ → ต้องดาวน์โหลดได้ (ลิงก์หมดอายุใน 60 วินาที ลองเปิดลิงก์ที่ redirect ไปซ้ำหลัง 1 นาที ต้องใช้ไม่ได้)
3. ล็อกอินเป็น `assignee` (รหัสในหมายเหตุ `docs/14`) → งานที่ตัวเองถูกมอบหมายต้องเห็นไฟล์, งานอื่นต้องไม่เห็น และไม่มีปุ่มแนบ/ลบ
4. เปิด `/monitor` (ไม่ล็อกอิน) → ต้องไม่มีร่องรอยไฟล์แนบใด ๆ
5. ตรวจ audit: หน้ารายละเอียดงานต้องมีบรรทัด "แนบไฟล์: ..." / "ลบไฟล์แนบ: ..."

---

## 3. ทดสอบ Export รายงาน

ไม่ต้องรอ migration — ใช้ได้ทันทีหลัง Supabase กลับมา

1. `/reports` → เลือกช่วงวันที่ → กด **ดาวน์โหลด Excel** → ได้ไฟล์ `pr-os-report-<from>_<to>.xlsx` เปิดใน Excel เห็น 4 ชีต (สรุป / รายการงาน / ภาระงานตามบุคคล / ค้างรับทราบ) ภาษาไทยไม่เพี้ยน
2. กด **พิมพ์ / บันทึกเป็น PDF** → เปิดแท็บใหม่ `/reports/print` → กดปุ่มพิมพ์ → เลือก "Save as PDF" ในกล่องพิมพ์ของเบราว์เซอร์
3. ตรวจ audit ใน Supabase:

```sql
select changed_at, action, summary, new_values->>'format' as format
from public.audit_logs
where entity_type = 'report'
order by changed_at desc limit 10;
```

หมายเหตุ: การส่งออกทั้งสองแบบ **ไม่รวม** หมายเหตุภายในและไฟล์แนบ ตาม `docs/08`

---

## 4. เปิดใช้การแจ้งเตือนจริง (ยังค้าง — รอ credential)

ใส่ค่าใน `.env.local` (ห้าม commit) — ชื่อคีย์ต้องตรงกับ `src/lib/env.ts`

```dotenv
LINE_LOGIN_CHANNEL_ID=
LINE_LOGIN_CHANNEL_SECRET=
LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=
RESEND_API_KEY=
RESEND_FROM_EMAIL=            # ใส่เมื่อมีโดเมนที่ verify แล้ว
NOTIFICATIONS_CRON_SECRET=    # สุ่มสตริงยาว ๆ
APP_BASE_URL=                 # URL production จริง เช่น https://pr-os.vercel.app
```

⚠️ `.env.local` ปัจจุบันยังมีคีย์ชื่อเก่า `LINE_CHANNEL_ACCESS_TOKEN` ซึ่ง **โค้ดไม่อ่านแล้ว** — ต้องเปลี่ยนชื่อเป็น `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`

ขั้นตอนหลังใส่ค่า

1. restart dev server → เข้า `/settings` หัวข้อการแจ้งเตือน แถบต้องเปลี่ยนจากเหลือง (โหมดจำลอง) เป็นเขียว (เชื่อมต่อแล้ว)
2. ให้พนักงานเปิด `/mobile/my-tasks` แล้วกด "เชื่อมต่อ LINE" เพื่อผูก LINE user id ของตัวเอง
3. **ก่อนส่งข้อความจริงหาคนจริงครั้งแรก ต้องยืนยันกับเจ้าของโปรเจกต์เสมอ** (Human Gate) — ทดสอบกับบัญชีตัวเองก่อน
4. ตั้ง cron ยิง `POST /api/notifications/process` พร้อม header `x-notifications-secret: <NOTIFICATIONS_CRON_SECRET>` — ทำได้เมื่อรู้ URL production แล้ว (Vercel Cron หรือ pg_cron + pg_net)

---

## 5. ก่อนแชร์โฟลเดอร์โปรเจกต์ให้คนภายนอก

⚠️ `.env.local` **ไม่ได้ถูก commit** (อยู่ใน `.gitignore`) แต่ยังอยู่ในโฟลเดอร์บนเครื่อง ใครก็ตามที่เข้าถึงโฟลเดอร์ได้จะเห็น **Supabase URL + anon key + service role key** ซึ่งพอที่จะอ่าน/เขียนฐานข้อมูลจริงได้ (service role bypass RLS ทั้งหมด)

ทางเลือกก่อนให้ที่ปรึกษาภายนอกเข้าถึง:

- ให้เข้าถึงผ่าน GitHub repo แทนโฟลเดอร์บนเครื่อง (repo ไม่มี `.env.local` อยู่แล้ว) — ปลอดภัยที่สุด
- ถ้าต้องให้เข้าโฟลเดอร์จริง: ย้าย `.env.local` ออกไปชั่วคราว หรือส่ง `.env.example` แทน
- ถ้าคีย์หลุดไปแล้ว: Supabase dashboard → Settings → API → **rotate service role key** แล้วอัปเดตในเครื่อง

ดูบริบทที่ควรส่งให้ที่ปรึกษาที่ `docs/16-external-review-brief.md`
