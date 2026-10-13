# Data Model

## Design Principles

- Core operational fields are real columns, not only JSON metadata
- Flexible future fields live in `events.metadata` or `settings` only when the value is not needed for filtering/reporting
- Audit logs are append-only
- Attachments are private by default
- Soft delete is preferred over hard delete
- Master data can be deactivated

## Core Tables

### events

Stores one PR work item or event.

Key columns:

- `id`
- `title`
- `description`
- `event_date`
- `start_time`
- `end_time`
- `location_id`
- `owner_department_id`
- `event_type_id`
- `intake_channel`
- `source_reference` — เลขที่หนังสือราชการ (ภายใน ไม่แสดงบนจอมอนิเตอร์; ฟอร์มใช้ตั้งแต่ 0014)
- `source_url` — ลิงก์หนังสือใน e-Office; CHECK รับเฉพาะ `http(s)://` ยาวไม่เกิน 500 (`0014`)
- `status`: `draft`, `published`, `completed`, `canceled`
- `urgency`: `normal`, `important`, `urgent`
- `short_note`
- `internal_note`
- `metadata`
- `published_at`
- `canceled_at`
- `cancellation_reason`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`
- `deleted_at`

### assignments

Stores who is assigned to an event and in what role.

Key columns:

- `id`
- `event_id`
- `person_id`
- `role_id`
- `assignment_status`: `assigned`, `removed`
- `assignment_version`
- `note`
- `declined_at`, `declined_version`, `decline_reason` — "ไม่สะดวก" (`0014`). มีผลเฉพาะเมื่อ
  `declined_version = assignment_version`: แก้สาระสำคัญแล้ว version เพิ่ม ธงเดิมหมดผล
  เขียนได้ผ่าน `decline_assignment()` เท่านั้น; การรับทราบใหม่ล้างธงด้วย trigger
  `acknowledgements_clear_decline`. เหตุผลอาจเป็นข้อมูลส่วนบุคคล (เช่น ป่วย) จึงแสดงเฉพาะหน้างาน
  สำหรับฝ่ายจัดการ ไม่อยู่ในรายงาน/Excel/จอมอนิเตอร์
- `created_by`
- `created_at`
- `removed_at`

### acknowledgements

Stores assignee acknowledgement per assignment version.

Key columns:

- `id`
- `assignment_id`
- `assignment_version`
- `acknowledged_by`
- `acknowledged_at`
- `acknowledgement_channel`: `web`, `mobile_web`
- `user_agent`
- `ip_address`

### audit_logs

Stores append-only change history.

Key columns:

- `id`
- `entity_type`
- `entity_id`
- `action`
- `changed_by`
- `changed_at`
- `summary`
- `old_values`
- `new_values`
- `request_id`

### notifications

Stores notification queue and send history.

Key columns:

- `id`
- `event_id`
- `assignment_id`
- `person_id`
- `channel`: `line`, `email`
- `notification_type`: `assignment`, `reminder`, `change`, `cancellation`,
  `declined` (แจ้งหัวหน้าเมื่อมีคนกดไม่สะดวก), `escalation` (แจ้งหัวหน้า N ชม. ก่อนงานถ้ายังมีคนไม่ตอบ),
  `digest` (สรุปงานพรุ่งนี้ คนละ 1 ข้อความ, `event_id`/`assignment_id` เป็น null) — 3 ค่าหลังมาจาก `0014`
- `dedupe_key` — unique (null ไม่ชนกัน) กันแถวซ้ำเมื่อ cron กับปุ่มประมวลผลคิวทำงานพร้อมกัน
  รูปแบบ `digest:<person>:<date>`, `escalation:<event>:<person>:<epoch>`, `reminder:<assignment>:<epoch>`,
  `declined:<assignment>:<version>:<person>`
- `scheduled_for`
- `sent_at`
- `status`: `queued`, `sent`, `failed`, `skipped`
- `provider_message_id`
- `error_message`
- `quota_month`
- `created_at`

## Master Tables

### people

- `id`
- `display_name`
- `position`
- `email`
- `line_user_id`
- `is_active`
- `metadata`

Initial staff list for pilot data:

- นางสาวภนิตา ชะรัดรัมย์: รักษาการในตำแหน่ง หัวหน้าฝ่ายบริการและเผยแพร่วิชาการ
- นายธนันธร พันธุ์รอด: หัวหน้างานประชาสัมพันธ์
- นายประชารักษ์ ประทุมโทน: นักประชาสัมพันธ์ปฏิบัติการ
- นางสาวณัฏฐ์ จิรจีรังชัย: นักประชาสัมพันธ์ปฏิบัติการ
- นางสาวภัททิรา แย้มเผื่อน: พนักงานจ้างทั่วไป
- นางสาวเทียมแข กิจกล้า: พนักงานจ้างทั่วไป

Operational rule: admins must be able to add staff, edit contact data, deactivate staff, and hide inactive staff from new assignments. Do not hard-delete staff already referenced by assignments, acknowledgements, notifications, or audit logs.

### departments

- `id`
- `name`
- `short_name`
- `is_active`

### locations

- `id`
- `name`
- `description`
- `is_active`

### event_types

- `id`
- `name`
- `color`
- `is_active`

### roles

- `id`
- `name`
- `code`
- `color`
- `is_active`

### settings

- `key`
- `value`
- `description`
- `updated_at`
- `updated_by`

คีย์ที่เกี่ยวกับการแจ้งเตือน: `line_enabled`, `email_enabled`, `line_monthly_quota`,
`default_reminder_hours` (ใช้เมื่อปิดสรุปรายวัน), `same_day_reminder_enabled`,
`fallback_to_email_when_line_fails`, `fallback_to_email_when_quota_exceeded`,
`daily_digest_enabled` (ค่าเริ่มต้น true), `daily_digest_hour` (17), `escalation_hours_before` (3, 0 = ปิด)
— สามตัวหลังมาจาก `0014`

### display_tokens

- `id`
- `name`
- `token_hash`
- `allowed_scope`
- `is_active`
- `last_used_at`
- `expires_at`

### event_attachments

Implemented in `supabase/migrations/0010_event_attachments.sql`. Metadata only — the file bytes live in the private Storage bucket `event-attachments`.

- `id`
- `event_id`
- `storage_path`: unique, `'<event_id>/<uuid>.<ext>'` (the first path segment is what Storage RLS checks)
- `file_name`: original user-supplied name, never used to build the path
- `mime_type`
- `size_bytes`
- `uploaded_by`
- `created_at`
- `deleted_at`: soft delete, so an audit entry can still resolve the name after the object is removed

Access:

- admin/supervisor/staff: read, upload, delete
- assignee: read only, and only for events assigned to them
- anon/display: no access; the monitor feed never joins this table

Bucket limits: private, 10 MB per file, MIME allowlist (PDF, Word, Excel, JPG/PNG/WebP).

## Important Relationships

- One event has many assignments
- One assignment belongs to one person and one role
- One assignment has many acknowledgements across assignment versions
- One event has many notifications
- One event has many audit logs
- Master tables are referenced by ID and should not be hard-deleted if already used

## Reporting Views

Recommended views:

- `v_event_schedule`: published events with joined location, department, type, and assignment summary
- `v_assignment_ack_status`: assignment with latest acknowledgement status
- `v_workload_by_person`: count events grouped by person, role, and date range
- `v_event_change_summary`: significant change and cancellation counts
- `v_notification_quota`: messages counted by month and channel
