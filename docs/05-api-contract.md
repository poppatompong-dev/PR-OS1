# API Contract

## Contract Style

This document defines the intended HTTP contract for the Next.js application layer. Actual implementation may use Next.js Route Handlers, Supabase client queries, or server actions, but the behavior should remain compatible with this contract.

## Auth

All operational endpoints require authenticated users except monitor endpoints that use a display token.

Login uses **username/password**. The app resolves the username to its account email server-side via the `get_login_email(username)` RPC (the email is never exposed to the browser), then performs Supabase email/password sign-in. Entering a full email also works.

Recommended headers:

```http
Authorization: Bearer <supabase-session-token>
X-Request-Id: <uuid>
```

## Events

### GET /api/events

Purpose: list events for schedule table.

Query parameters:

- `from`: ISO date
- `to`: ISO date
- `status`: draft, published, completed, canceled
- `departmentId`
- `personId`
- `ackStatus`: acknowledged, pending
- `search`

Response:

```json
{
  "items": [
    {
      "id": "evt_001",
      "title": "พิธีเปิดโครงการ",
      "eventDate": "2026-07-01",
      "startTime": "09:00",
      "location": { "id": "loc_001", "name": "ห้องประชุมสภา" },
      "ownerDepartment": { "id": "dep_001", "name": "สำนักปลัดเทศบาล" },
      "status": "published",
      "urgency": "normal",
      "assignments": [
        { "personName": "นายปฐมพงษ์", "roleName": "ช่างภาพ", "ackStatus": "acknowledged" }
      ]
    }
  ],
  "page": 1,
  "pageSize": 50,
  "total": 1
}
```

### POST /api/events

Purpose: create event draft.

Body:

```json
{
  "title": "ประชุมเตรียมความพร้อม",
  "eventDate": "2026-07-02",
  "startTime": "13:30",
  "locationId": "loc_001",
  "ownerDepartmentId": "dep_001",
  "eventTypeId": "typ_001",
  "intakeChannel": "official_letter",
  "shortNote": "เตรียมถ่ายภาพและทำข่าว",
  "assignments": [
    { "personId": "per_001", "roleId": "role_photo" }
  ]
}
```

### PATCH /api/events/:id

Purpose: update event and create audit log.

Rules:

- Significant changes create audit log
- Significant changes on published events queue change notifications
- Changing assignees increments assignment version for affected assignments

### POST /api/events/:id/publish

Purpose: publish reviewed event.

Rules:

- Required fields must be complete
- Event becomes visible on monitor
- Assignment notification can be queued depending on settings

### POST /api/events/:id/cancel

Purpose: cancel event with reason.

Body:

```json
{ "reason": "หน่วยงานเจ้าของเรื่องแจ้งเลื่อนกิจกรรม" }
```

## Assignments And Acknowledgements

### GET /api/my-assignments

Purpose: mobile page for assignee.

Query:

- `from`
- `to`
- `ackStatus`

### POST /api/assignments/:id/acknowledge

Purpose: acknowledge assignment.

Body:

```json
{ "assignmentVersion": 3 }
```

Response:

```json
{
  "assignmentId": "asg_001",
  "acknowledgedAt": "2026-06-29T10:00:00+07:00",
  "status": "acknowledged"
}
```

## Monitor

### GET /api/monitor/events

Purpose: monitor-safe event feed.

Auth:

- display token via `token` query parameter or secure cookie

Rules:

- Return published events only
- Hide internal notes, personal phone numbers, private attachment URLs, audit logs
- Default range: today through next 7 days

## Reports

### GET /api/reports/summary

Query:

- `from`
- `to`
- `departmentId`
- `personId`

Response contains:

- KPI cards
- workload summary
- unacknowledged assignments
- change/cancellation summary
- smart summary text

### GET /api/reports/export

Implemented in `src/app/api/reports/export/route.ts` — Excel only.

Query:

- `from`
- `to`
- `departmentId` (optional)

Behavior:

- Requires a session; `403` unless the role passes `can.viewReports` (admin/supervisor)
- Returns an `.xlsx` file built by the dependency-free writer in `src/lib/export/xlsx.ts` (sheets: สรุป / รายการงาน / ภาระงานตามบุคคล / ค้างรับทราบ)
- Uses exactly the filters passed from the report screen
- Writes an `audit_logs` row (`entity_type = 'report'`, `entity_id` = nil UUID, `action = 'export'`, `new_values.format = 'xlsx'`)
- Excludes internal notes and attachments so a forwarded file cannot leak them

### GET /reports/print (PDF path)

PDF is produced through the browser print dialog rather than a server-side PDF library — that keeps Thai typography correct and adds nothing to the bundle.

- Print-optimized page at `src/app/reports/print/page.tsx`, same filters (`from`, `to`, `departmentId`)
- Requires a session + `can.viewReports`
- Logs the same audit row with `new_values.format = 'pdf'`

## Attachments

### GET /api/attachments/[id]

Implemented in `src/app/api/attachments/[id]/route.ts`.

- Requires a session; `401` when absent
- Looks the row up through the caller's own session, so RLS decides visibility; missing row and "hidden by RLS" both return `404`
- On success returns `302` to a Supabase Storage signed URL valid for 60 seconds, with `Cache-Control: no-store`
- Signed URLs are never rendered into HTML

### Upload / delete

Server actions in `src/lib/attachments/mutations.ts` (`uploadAttachment`, `deleteAttachment`), called from the event detail screen.

- Backend roles only (`can.editPublished`)
- Client-side limits mirror the bucket: 10 MB, MIME allowlist
- Failed metadata insert removes the just-uploaded object (no orphans)
- Delete removes the Storage object and soft-deletes the metadata row
- Both write `audit_logs` entries (`attachment_upload` / `attachment_delete`)

## Notifications

### POST /api/notifications/process

Implemented in `src/app/api/notifications/process/route.ts`. Triggers `processDueNotifications()` — sends every queued notification whose `scheduled_for` has passed via LINE Messaging API / Resend email, applying quota guard and fallback settings.

Not session-gated (no user is logged in when an external cron calls it); instead requires header `x-notifications-secret` to match `NOTIFICATIONS_CRON_SECRET`. Returns `401` if missing/mismatched. Intended caller: pg_cron + pg_net (or any external scheduler) once a production URL exists — not yet wired up.

Also reachable manually from `/settings` via the "ประมวลผลคิว" button (calls the same underlying function server-side, bypassing the secret check since it's already behind `requireAdmin()`).

### POST /api/notifications/test

Not yet implemented. Admin-only endpoint for testing LINE or Email template.

### GET /api/notifications/quota

Not yet implemented. Returns monthly quota usage by channel.

## Master Data

### GET /api/people

Purpose: list staff for assignment, notification, and settings screens.

Query:

- `active`: true, false, all
- `search`

### POST /api/people

Purpose: add staff without code changes.

Body:

```json
{
  "displayName": "นางสาวภนิตา ชะรัดรัมย์",
  "position": "รักษาการในตำแหน่ง หัวหน้าฝ่ายบริการและเผยแพร่วิชาการ",
  "isActive": true
}
```

### PATCH /api/people/:id

Purpose: edit staff details or deactivate staff.

Rules:

- Deactivated staff must not appear as default choices for new assignments
- Existing assignment history must keep the original person reference
- Changes must be written to audit logs

### DELETE /api/people/:id

Purpose: remove only staff records that have never been referenced. For referenced staff, use deactivate instead.
