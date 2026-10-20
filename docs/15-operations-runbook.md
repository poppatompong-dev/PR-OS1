# Operations Runbook

คู่มือปฏิบัติการสำหรับเจ้าของโปรเจกต์ (ไม่ใช่ agent) — งานที่ต้องทำเองบน Supabase / เครื่อง production
อัปเดตล่าสุด: 19 ตุลาคม 2569

รายการในไฟล์นี้อยู่หลัง **Human Gate** ตาม `CLAUDE.md` คือ agent เตรียม SQL/โค้ดให้ได้ แต่ไม่รันให้เอง เพราะกระทบ project จริง/ข้อมูลจริง/ส่งข้อความจริง

มีเวอร์ชันหน้าเว็บสำหรับส่งต่อให้ผู้ช่วยลงมือทำ (เนื้อหาเดียวกัน เรียงเป็นงาน 1–10 พร้อมช่องตรวจสอบ):
<https://claude.ai/code/artifact/4a3ea6b6-5794-448d-9d71-1565b278489b>

---

## 1. สถานะฐานข้อมูลจริง (ใช้งานแล้ว)

ตั้งแต่ 11 ต.ค. 2569 production ต่อ Supabase จริงแล้ว — project ref `ewwbmqpwxnbfqwpmoomp` รัน migration `0001`–`0013` ครบ

> ⛔ **ห้ามรัน `supabase db push` / `supabase migration up`** migration ทั้งหมดรันมือผ่าน SQL Editor ตาราง tracker ของ CLI จึงว่าง
> CLI จะพยายามรัน `0001` ใหม่ทับฐานข้อมูลจริง → `type already exists` และอาจพังกลางทาง

**ตรวจว่าระบบยังต่อฐานข้อมูลอยู่**

```bash
curl -s https://pr-os1.vercel.app/api/health
# ต้องเห็น "mode":"live" และ "database":"connected"
```

**กัน pause:** `.github/workflows/keep-alive.yml` เรียก `/api/health` ทุกวัน 10:17 น. (ไม่ต้องตั้ง secret) ต้องเขียวทุกวัน
ถ้าแดงและได้อีเมลแจ้งจาก GitHub → เข้า https://supabase.com/dashboard ดูว่าโปรเจกต์ถูก pause ไหม ถ้าใช่กด **Restore project**
(แผนฟรี pause เมื่อไม่มี activity 7 วัน และกู้คืนได้ภายใน 90 วัน) ถ้าโปรเจกต์ไม่ได้ pause ให้ตรวจตัวแปร Supabase บน Vercel

---

## 2. Migration — ประวัติ และวิธีรันตัวใหม่

รันครบแล้วทั้งหมด (มือ ผ่าน SQL Editor) **ไม่ต้องรันซ้ำ**

| ไฟล์ | ทำอะไร |
|---|---|
| `0001`–`0008` | schema, auth/RLS, monitor feed, hardening, บัญชี, คิวแจ้งเตือน, ล็อกอินด้วย username, รายชื่อบนจอ |
| `0009`–`0012` (หรือ `combined_0009_to_0012.sql`) | settings การส่ง, ไฟล์แนบ, ข้อมูลหลักนครสวรรค์, คิวเตือนล่วงหน้า + เช็กเวลาชน |
| `0013_monitor_board.sql` | `get_monitor_events()` เพิ่ม status / เหตุผลยกเลิก / ผู้รับทราบรายคน (ตรวจผลแล้ว 11 ต.ค.) |

**migration ใหม่ต่อจากนี้** (`0014` เฟส LINE, `0015` ฟีเจอร์หลัง LINE)

1. agent เขียนไฟล์ครอบ `begin;` … `commit;` และทดสอบกับ Postgres จำลองก่อน
2. agent เขียน SQL ตรวจผล (read-only) แนบมาด้วย
3. owner วางรันใน SQL Editor เอง แล้วรัน SQL ตรวจผล — ถ้า error ทั้งก้อนจะ rollback เอง ฐานข้อมูลเดิมไม่เสีย
4. **สำรองข้อมูลก่อนทุกครั้ง** — กด Run workflow "Database backup" ใน GitHub Actions (ข้อ 7) แล้วรอให้เขียวก่อนรัน migration

### อ้างอิง: ตรวจไฟล์แนบ (จาก migration 0010)

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

**ทดสอบไฟล์แนบด้วยมือ**

1. ล็อกอินเป็น `admin` → เปิดงานสักงาน → แนบไฟล์ PDF → ต้องเห็นชื่อไฟล์ + ขนาด
2. กดชื่อไฟล์ → ต้องดาวน์โหลดได้ (ลิงก์หมดอายุใน 60 วินาที ลองเปิดลิงก์ที่ redirect ไปซ้ำหลัง 1 นาที ต้องใช้ไม่ได้)
3. ล็อกอินเป็น `assignee` (รหัสในหมายเหตุ `docs/14`) → งานที่ตัวเองถูกมอบหมายต้องเห็นไฟล์, งานอื่นต้องไม่เห็น และไม่มีปุ่มแนบ/ลบ
4. เปิด `/monitor` (ไม่ล็อกอิน) → ต้องไม่มีร่องรอยไฟล์แนบใด ๆ
5. ตรวจ audit: หน้ารายละเอียดงานต้องมีบรรทัด "แนบไฟล์: ..." / "ลบไฟล์แนบ: ..."

---

## 3. ทดสอบ Export รายงาน

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

## 4. เปิดใช้การแจ้งเตือนจริงผ่าน LINE (ยังค้าง — รอ owner สร้าง OA)

ไม่ใช้อีเมล (owner เลือก 19 ต.ค. 2569) จึงไม่ต้องใส่ `RESEND_API_KEY` รูปแบบการส่งดู `STATE.md` หัวข้อ "ตัดสินใจแล้ว — LINE bot"

1. สร้าง LINE Official Account ชื่อ "ผู้ช่วยงาน ปชส." แล้วเปิด Messaging API
2. ใน LINE Developers สร้าง channel **LINE Login** ใต้ **Provider เดียวกัน** กับ Messaging API (คนละ Provider = userId ไม่ตรงกัน ผูกบัญชีไม่ได้)
   callback URL: `https://pr-os1.vercel.app/api/auth/line/callback`
3. owner ใส่ค่าใน Vercel → Project `pr-os1` → Settings → Environment Variables (Production) เอง — **ห้ามวางค่าในแชท**

| ตัวแปร | เอามาจาก |
|---|---|
| `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` | Messaging API channel → Channel access token (long-lived) |
| `LINE_MESSAGING_CHANNEL_SECRET` | Messaging API channel → Basic settings → Channel secret (ใช้ตรวจลายเซ็น webhook) |
| `LINE_LOGIN_CHANNEL_ID` | LINE Login channel → Channel ID |
| `LINE_LOGIN_CHANNEL_SECRET` | LINE Login channel → Channel secret |
| `NOTIFICATIONS_CRON_SECRET` | สุ่มสตริงยาว ๆ เอง — ต้องตรงกับ secret ชื่อเดียวกันใน GitHub (ข้อ 6) |

4. Redeploy บน Vercel (ตัวแปรใหม่มีผลหลัง deploy ใหม่เท่านั้น)
5. **ก่อนส่งข้อความจริงหาคนจริงครั้งแรก ต้องยืนยันกับ owner เสมอ** (Human Gate) — ทดสอบกับบัญชีตัวเองก่อน

---

## 5. ก่อนแชร์โฟลเดอร์โปรเจกต์ให้คนภายนอก

⚠️ `.env.local` **ไม่ได้ถูก commit** (อยู่ใน `.gitignore`) แต่ยังอยู่ในโฟลเดอร์บนเครื่อง ใครก็ตามที่เข้าถึงโฟลเดอร์ได้จะเห็น **Supabase URL + anon key + service role key** ซึ่งพอที่จะอ่าน/เขียนฐานข้อมูลจริงได้ (service role bypass RLS ทั้งหมด)

ทางเลือกก่อนให้ที่ปรึกษาภายนอกเข้าถึง:

- ให้เข้าถึงผ่าน GitHub repo แทนโฟลเดอร์บนเครื่อง (repo ไม่มี `.env.local` อยู่แล้ว) — ปลอดภัยที่สุด
- ถ้าต้องให้เข้าโฟลเดอร์จริง: ย้าย `.env.local` ออกไปชั่วคราว หรือส่ง `.env.example` แทน
- ถ้าคีย์หลุดไปแล้ว: Supabase dashboard → Settings → API → **rotate service role key** แล้วอัปเดตในเครื่อง

ดูบริบทที่ควรส่งให้ที่ปรึกษาที่ `docs/16-external-review-brief.md`

---

## 6. ตัวตั้งเวลาส่งแจ้งเตือน (GitHub Actions)

`.github/workflows/notifications.yml` เรียก `POST /api/notifications/process` ทุก 15 นาที ช่วง 06:00–20:00 น.
(GitHub อาจเริ่มช้ากว่าเวลาจริงไม่กี่นาที — รับได้สำหรับการเตือนแบบนี้)

**ตั้งครั้งเดียว**

1. คิดรหัสสุ่มยาว ๆ 1 ชุด (เช่น เปิด PowerShell พิมพ์ `[guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()`)
2. Vercel → `pr-os1` → Settings → Environment Variables → เพิ่ม `NOTIFICATIONS_CRON_SECRET` = รหัสนั้น (Production) → Redeploy
3. GitHub → repo `PR-OS1` → Settings → Secrets and variables → Actions → **New repository secret**
   ชื่อ `NOTIFICATIONS_CRON_SECRET` ค่าเดียวกันเป๊ะ
4. GitHub → Actions → "Notifications — process due queue" → **Run workflow** → ต้องเขียว และใน log เห็น `HTTP 200`

| ผลใน log | แปลว่า |
|---|---|
| notice "is not set in GitHub yet" (เขียว) | ยังไม่ได้ทำข้อ 3 — ไม่มีอะไรถูกส่ง |
| `HTTP 401` (แดง) | ค่าใน GitHub กับ Vercel ไม่ตรงกัน หรือยังไม่ได้ redeploy Vercel |
| `HTTP 200` + `"skipped":N` | ทำงานแล้ว แต่ยังไม่มี LINE credential คิวจึงถูกข้ามแบบโหมดจำลอง |
| `HTTP 200` + `"sent":N` | ส่งจริงแล้ว |

> ก่อนมี LINE ตัวตั้งเวลาจะ mark คิวที่ถึงเวลาเป็น `skipped` ไป ไม่มีผลเสีย เพราะยังไม่มีช่องทางส่งอยู่แล้ว

---

## 7. สำรองฐานข้อมูลรายสัปดาห์ + วิธีกู้คืน

`.github/workflows/db-backup.yml` ทำงานทุกวันจันทร์ 02:41 น. dump ฐานข้อมูล → **เข้ารหัส AES-256 ด้วยรหัสของ owner** → เก็บใน GitHub 90 วัน

- สำรอง: ทุกตารางใน schema `public` (งาน บุคลากร การมอบหมาย การรับทราบ คิวแจ้งเตือน settings audit log) + บัญชีล็อกอิน `auth.users` / `auth.identities`
- **ไม่ได้สำรอง:** ไฟล์แนบใน Storage — ถ้าไฟล์สำคัญให้เก็บต้นฉบับไว้ที่อื่นด้วย
- ไฟล์มีชื่อจริงและเบอร์โทรเจ้าหน้าที่ จึงเข้ารหัสเสมอ ต่อให้ repo เป็น public คนอื่นก็เปิดไม่ได้

**ตั้งครั้งเดียว**

1. Supabase → โปรเจกต์ PR-OS1 → ปุ่ม **Connect** ด้านบน → เลือก **Session pooler** (ไม่ใช่ Direct connection — GitHub ไม่มี IPv6)
   คัดลอก URI หน้าตา `postgresql://postgres.ewwbmqpwxnbfqwpmoomp:[YOUR-PASSWORD]@aws-…pooler.supabase.com:5432/postgres`
   แล้วแทน `[YOUR-PASSWORD]` ด้วยรหัสผ่านฐานข้อมูล (ลืม → Project Settings → Database → Reset database password)
2. GitHub → Settings → Secrets and variables → Actions → New repository secret
   - `SUPABASE_DB_URL` = URI จากข้อ 1
   - `BACKUP_PASSPHRASE` = รหัสยาว ๆ ที่ตั้งเอง **จดเก็บไว้นอกคอมพิวเตอร์ด้วย** ถ้าลืม ไฟล์สำรองทุกไฟล์จะเปิดไม่ได้
3. GitHub → Actions → "Database backup (weekly, encrypted)" → **Run workflow** → ต้องเขียว และมีไฟล์ `pr-os-backup-YYYY-MM-DD` ในส่วน Artifacts

**ดาวน์โหลดและเปิดไฟล์สำรอง** (เครื่องที่มี `gpg` และ PostgreSQL client 17 เช่น WSL/Ubuntu)

```bash
unzip pr-os-backup-2026-10-26.zip            # GitHub ห่อ artifact เป็น zip
gpg --decrypt pr-os-backup-2026-10-26.tar.gpg > backup.tar   # ถามรหัส BACKUP_PASSPHRASE
tar -xf backup.tar                              # ได้ public.dump และ auth.dump
pg_restore --list public.dump | head            # ดูว่ามีอะไรบ้าง
```

**กู้คืน** — ทำเมื่อฐานข้อมูลเสียหายจริงเท่านั้น และให้ agent ช่วยดูก่อนทุกครั้ง

- กู้ลง **โปรเจกต์ Supabase ใหม่** ปลอดภัยที่สุด (ทดสอบขั้นตอนนี้กับ Postgres จำลองแล้ว 19 ต.ค. 2569) — **ไม่ต้อง** รัน migration ในโปรเจกต์ใหม่ก่อน
  เพราะ `public.dump` มีทั้งโครงสร้าง ฟังก์ชัน RLS สิทธิ์ และข้อมูลครบ

```bash
# 1) บัญชีล็อกอินก่อน (profiles อ้างถึง auth.users) — replica = ไม่ให้ trigger สร้าง profile ซ้ำ
pg_restore -f auth.sql auth.dump
psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 --single-transaction \
  -c 'set session_replication_role = replica' -f auth.sql

# 2) schema public ทั้งหมด (ข้ามคำสั่ง CREATE SCHEMA public เพราะโปรเจกต์ใหม่มีอยู่แล้ว)
pg_restore --list public.dump | grep -v ' SCHEMA - public ' > restore.list
pg_restore --dbname "$NEW_DB_URL" --no-owner --exit-on-error --single-transaction \
  --use-list=restore.list public.dump

# 3) trigger บน auth.users ไม่อยู่ใน public.dump ต้องสร้างคืนเอง (จาก migration 0002)
psql "$NEW_DB_URL" -c "create trigger on_auth_user_created after insert on auth.users \
  for each row execute function public.handle_new_user();"
```

  จากนั้นเปลี่ยน `NEXT_PUBLIC_SUPABASE_URL` / anon key / service role key บน Vercel ไปที่โปรเจกต์ใหม่ แล้ว redeploy
  ไฟล์แนบใน Storage ต้องอัปโหลดคืนเอง และสร้าง bucket `event-attachments` + policy ตาม migration `0010`
- ห้าม `pg_restore --clean` ลงโปรเจกต์เดิมที่ใช้งานอยู่ — จะลบข้อมูลปัจจุบันทิ้งก่อน

---

## 8. เปิดใช้ LINE bot — ทำตามลำดับนี้เท่านั้น

> ⚠️ **ลำดับสำคัญ:** ต้องรัน `0014` **ก่อน** push โค้ดเฟส LINE ขึ้น GitHub
> โค้ดใหม่อ่านคอลัมน์ `unavailable_at` ที่ `0014` เพิ่ม — ถ้า push ก่อน หน้าตารางงาน/งานของฉันจะ error จนกว่าจะรัน `0014`

**ขั้น 1 — สำรองข้อมูลก่อน** GitHub → Actions → "Database backup (weekly, encrypted)" → Run workflow → รอเขียว (ข้อ 7)

**ขั้น 2 — ตรวจก่อนรัน** (read-only) วางใน SQL Editor ต้องได้ **0 แถว** (ไม่มี LINE userId ซ้ำ) ถ้าได้แถว หยุดแล้วบอก agent

```sql
select line_user_id, count(*) from public.people
where line_user_id is not null group by 1 having count(*) > 1;
```

**ขั้น 3 — รัน migration** เปิด `supabase/migrations/0014_line_bot.sql` คัดลอกทั้งไฟล์ วางใน SQL Editor แล้ว Run
ต้องขึ้น `Success. No rows returned` ถ้า error ให้คัดลอกข้อความ error มาให้ agent — ไฟล์ครอบ `begin`/`commit` ไว้ จะ rollback เอง

**ขั้น 4 — ตรวจผล** (read-only)

```sql
select enum_range(null::public.notification_type);
-- ต้องมี daily_summary, admin_report, unavailable, quota_warning

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'assignments' and column_name like 'unavailable%';
-- ต้องได้ 2 แถว

select key, value from public.settings
where key in ('line_admin_person_ids', 'same_day_reminder_enabled', 'line_monthly_quota');
-- ต้องได้ 3 แถว (same_day_reminder_enabled = true)

select has_function_privilege('anon', 'public.get_monitor_events()', 'execute');
-- ต้องได้ true (จอทีวียังดึงข้อมูลได้)

-- ช่องโหว่สิทธิ์ปิดแล้ว: คนที่ไม่ได้ล็อกอินต้องเรียกฟังก์ชันคิว/เตือน/เช็กเวลาชนไม่ได้
select
  has_function_privilege('anon', 'public.process_notification_queue()', 'execute') as q,
  has_function_privilege('anon', 'public.enqueue_event_notifications(uuid, notification_type)', 'execute') as n,
  has_function_privilege('anon', 'public.enqueue_event_reminders(uuid)', 'execute') as r,
  has_function_privilege('anon', 'public.cancel_event_reminders(uuid)', 'execute') as c,
  has_function_privilege('anon', 'public.check_staff_conflict(uuid, date, time, time, uuid)', 'execute') as s;
-- ต้องได้ false ทั้ง 5 ช่อง
```

**ขั้น 5 — push โค้ด** `git push` ใน `D:\PR-OS1` แล้วรอ Vercel deploy เสร็จ จากนั้นเปิด `/monitor` และ `/schedule` ดูว่าปกติ

**ขั้น 6 — สร้าง LINE** ตามข้อ 4 (OA + Messaging API + LINE Login ใต้ Provider เดียวกัน, ใส่ 4 ตัวแปรบน Vercel, Redeploy)

**ขั้น 7 — ตั้งค่าใน LINE**

- LINE Developers → Messaging API → **Webhook URL** = ค่าที่หน้า `/settings` แสดง (`https://pr-os1.vercel.app/api/line/webhook`) → กด Verify ต้องขึ้น Success → เปิด **Use webhook**
- Messaging API → **Allow bot to join group chats** = เปิด (จะดึงบอทเข้ากลุ่มฝ่ายได้)
- LINE Official Account Manager → การตั้งค่าการตอบกลับ: **ปิด** ข้อความตอบกลับอัตโนมัติ และ **ปิด** ข้อความทักทาย (บอทส่งข้อความต้อนรับเอง)

**ขั้น 8 — ตั้งค่าในระบบ** `/settings` หัวข้อการแจ้งเตือน

1. ติ๊ก "ผู้รับแจ้งเตือนฝั่งแอดมิน" = ตัวคุณ + หัวหน้างาน ปชส. → บันทึก
2. กด **ตั้งค่าเมนูใต้แชท LINE** (ทำครั้งเดียว กดซ้ำได้ ไม่เสียอะไร)

**ขั้น 9 — ทดสอบกับตัวเองก่อน (Human Gate)**

1. แอดเพื่อน OA ด้วยมือถือตัวเอง → บอทจะส่งปุ่ม "ผูกบัญชี" → กด → เข้าด้วยชื่อผู้ใช้ → อนุญาต LINE → กลับมาที่ "งานของฉัน" ขึ้นว่าเชื่อมต่อสำเร็จ
2. สร้างงานทดสอบ มอบหมายให้ตัวเอง → เผยแพร่ → รอไม่เกิน 15 นาที (หรือกด "ประมวลผลคิว") → ต้องได้การ์ดมีปุ่ม รับทราบ / ไม่สะดวก / ดูรายละเอียด
3. กด "รับทราบ" → หน้า "งานของฉัน" ต้องขึ้นรับทราบแล้ว · พิมพ์ "งานวันนี้" / "งานพรุ่งนี้" ต้องตอบ
4. ลบ/ยกเลิกงานทดสอบ

**ขั้น 10 — เปิดใช้กับกลุ่มงานจริง** (owner 20 ต.ค. 2569: เจ้าหน้าที่ใช้แค่กลุ่มไลน์งานที่มีอยู่ ไม่ต้องเข้าระบบ)

1. แอดมินเชิญบอท "ผู้ช่วยงาน ปชส." เข้ากลุ่มไลน์งาน ปชส. ที่มีอยู่แล้ว
2. แอดมิน (ที่ผูก LINE แล้ว และอยู่ในรายชื่อรับแจ้งเตือนฝั่งแอดมิน) พิมพ์ `อนุญาตกลุ่มนี้` 1 ครั้ง → บอทตอบ + โพสต์การ์ด **ลงทะเบียนรับแจ้งงาน**
   (บอทไม่ตอบในกลุ่มที่ยังไม่อนุญาต — กันคนนอกเชิญบอทเข้ากลุ่มของตัวเองแล้วถามตารางงาน)
3. เจ้าหน้าที่แต่ละคนกดปุ่มในการ์ด 1 ครั้ง แล้วกด **เพิ่มเพื่อน** ที่บอทตอบกลับ (LINE ส่งข้อความส่วนตัวได้เฉพาะคนที่เป็นเพื่อน) — การ์ดหลุดไปไกลแล้ว พิมพ์ `ลงทะเบียน` ในกลุ่ม บอทโพสต์ให้ใหม่
4. แอดมินเปิด `/settings` → กล่อง **LINE ที่ลงทะเบียนจากกลุ่ม** → เลือกว่าแต่ละ LINE เป็นใคร (ระบบเดาจากชื่อ LINE) → **ยืนยัน** · ดูคอลัมน์สถานะว่าเพิ่มเพื่อนแล้วหรือยัง

ทางเลือกสำรอง: เจ้าหน้าที่ยังผูกเองได้จากปุ่ม "ผูกบัญชี" ในแชทส่วนตัวกับบอท (ต้องเข้าด้วยชื่อผู้ใช้ PR-OS)
รายการรอยืนยันเก็บใน `settings.line_pending_registrations` (ไม่มีตารางแยก) · หน้า `/settings` บอกว่าใครยังไม่ผูก LINE

**ค่าใช้โควต้า (แผนฟรี 300/เดือน)** การ์ดมอบหมาย/แก้ไข/ยกเลิก · สรุป 07:00 · เตือน 1.5 ชม. · รายงาน 17:00 · แจ้งไม่สะดวก — นับทุกข้อความ
การพิมพ์ถามบอทและการกดปุ่มในแชท **ไม่นับ** (เป็นการตอบกลับ)
