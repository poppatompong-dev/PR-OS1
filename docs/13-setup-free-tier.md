# Setup (Free Tier)

คู่มือตั้งค่า PR-OS บนบริการฟรีทั้งหมด สำหรับ pilot ของเทศบาล

## สแตกฟรี

| ส่วน | บริการ | โควต้าฟรีที่เกี่ยวข้อง |
| --- | --- | --- |
| DB + Auth + Storage + RLS | Supabase Free | 500MB DB, 50k auth users, 1GB storage, โปรเจกต์ pause หลังไม่ใช้ 7 วัน |
| Cron แจ้งเตือน | Supabase `pg_cron` | ฟรี ไม่จำกัดรอบ (แทน Vercel cron ที่ฟรีได้วันละครั้ง) |
| Hosting | Vercel Hobby | ฟรีสำหรับ Next.js |
| แจ้งเตือนหลัก | LINE Messaging API | โควต้าฟรีต่อเดือน + quota guard ในระบบ |
| Email fallback | Resend (3k/เดือน) หรือ Gmail SMTP | เลือกตอน Sprint 5 |

## ขั้นตอนของผู้ดูแล (ทำครั้งเดียว)

### 1. สร้าง Supabase project (ฟรี)

1. สมัคร/เข้า https://supabase.com แล้วกด **New project**
2. ตั้งชื่อ เช่น `pr-os`, เลือก region ใกล้ไทย (เช่น Singapore), ตั้ง database password
3. รอ provision เสร็จ (~2 นาที)

### 2. เอา keys มาใส่ `.env.local`

ที่ Supabase: **Project Settings → API** จะเห็น 3 ค่า เอามาวางใน `D:\PR-OS1\.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...        # anon / public key
SUPABASE_SERVICE_ROLE_KEY=eyJ...            # service_role key (เซิร์ฟเวอร์เท่านั้น ห้ามขึ้น client)
APP_BASE_URL=http://localhost:3000
```

> เมื่อใส่ค่าจริง (ไม่ใช่ค่า placeholder) ระบบจะ "เปิด" auth + RLS อัตโนมัติ
> ผ่านตัวเช็ก `isSupabaseConfigured()` ใน `src/lib/env.ts`

### 3. รัน schema

ที่ Supabase: **SQL Editor** → รัน migration ตามลำดับเลข แล้วตามด้วย seed
1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_auth_rls_and_views.sql`
3. `supabase/migrations/0003_monitor_feed.sql`
4. `supabase/migrations/0004_db_hardening.sql`
5. `supabase/migrations/0005_settings_accounts.sql`
6. `supabase/migrations/0006_notifications.sql`
7. `supabase/migrations/0007_username_login.sql`
8. `supabase/seed.sql` (ข้อมูลตั้งต้นภาษาไทย) — และ `supabase/seed_events.sql` หากต้องการ demo งาน

### 4. สร้างผู้ใช้คนแรก + ตั้งเป็น admin

ระบบล็อกอินด้วย **username** (อีเมลใช้เบื้องหลังเท่านั้น)

1. **Authentication → Users → Add user** ใส่อีเมล (ใช้รูปแบบใดก็ได้) + รหัสผ่าน และ**ติ๊ก Auto Confirm User**
2. โปรไฟล์จะถูกสร้างอัตโนมัติด้วย role `assignee` ยกระดับเป็น admin + ตั้ง username ใน SQL Editor:
   ```sql
   update public.profiles
   set role = 'admin', username = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
3. หลังจากนี้จัดการบัญชีอื่น ๆ (username / role / ผูกบุคลากร) ได้จากหน้า **`/settings`** โดยตรง
4. เข้าสู่ระบบที่ `/login` ด้วย username (เช่น `admin`) + รหัสผ่าน

### 5. รีสตาร์ท dev server

```bash
npm run dev
```

## สถานะการพัฒนาและสิ่งที่เหลือ

ดูภาพรวมล่าสุดของสิ่งที่ทำเสร็จแล้ว/ยังเหลือ ได้ที่ **`docs/14-implementation-status.md`** (อัปเดตตามการพัฒนา)
