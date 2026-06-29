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
- `source_reference`
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
- `notification_type`: `assignment`, `reminder`, `change`, `cancellation`
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

### display_tokens

- `id`
- `name`
- `token_hash`
- `allowed_scope`
- `is_active`
- `last_used_at`
- `expires_at`

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
