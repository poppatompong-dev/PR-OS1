# Security And Permissions

## Security Baseline

MVP minimum:

- Every backend user must login
- Attachments are private by default
- Display screen uses display token, not a normal user account
- Audit logs are append-only
- Daily backup is required
- Role checks exist in both UI and server/database layer

## Roles

### Admin

- Manage users
- Manage settings
- Manage master data
- View all logs
- Manage display tokens

### Supervisor

- Create, edit, publish, complete, and cancel events
- View reports
- View audit logs
- Manage assignments

### Staff

- Create draft
- Edit own draft or permitted events
- Upload attachments
- View schedule

### Assignee

- View own assignments
- Acknowledge own assignments
- View allowed attachments for assigned events

### Display

- Read monitor-safe fields only
- No write permission
- No private attachment access

## Row Level Security Direction

Recommended RLS behavior:

- `events`: backend users can read according to role; display token uses a restricted function or API route
- `assignments`: assignees can read their own assignments
- `acknowledgements`: assignees can insert acknowledgement for their own active assignments
- `attachments`: private bucket, signed URLs only for permitted users
- `audit_logs`: insert via server-side mutation, read by admin/supervisor
- `notifications`: admin/supervisor read; system job writes

## Audit Log Rules

Audit logs should capture:

- entity type
- entity id
- action
- actor
- timestamp
- old values
- new values
- human-readable summary

Audit logs should not be editable from the UI. If a correction is needed, create another audit record.

## Attachment Privacy

Implemented in migration `0010_event_attachments.sql` + `src/lib/attachments/`:

- Files live in the private bucket `event-attachments` (10 MB cap, MIME allowlist)
- Storage RLS: backend roles read/write; an assignee reads only objects whose first path segment is an event assigned to them; anon has no policy at all
- Signed URLs are created per request from the caller's own session (`/api/attachments/[id]`), live 60 seconds, and are never embedded in HTML
- Storage path is `'<event_id>/<uuid>.<ext>'` — the user-supplied file name is stored in metadata only, so a hostile name cannot alter the path
- Monitor never receives attachment URLs (the monitor RPC does not join the table)
- Report exports (Excel + print/PDF) exclude attachments and internal notes entirely
- Upload and delete both write `audit_logs` rows

## Display Token

Display tokens should:

- Be hashed in database
- Be revocable
- Have optional expiration
- Be scoped to monitor feed only
- Update `last_used_at`

## Backup

Minimum:

- Daily database backup
- Storage backup policy documented
- Manual export path for key tables
- Restore test at least once before production launch

## Threats To Watch

- Public exposure of monitor URL
- Attachment URLs leaked in browser or export
- Staff editing published event without audit log
- Notification sent to wrong person
- LINE quota exhausted silently
- Old display token left active after monitor replacement
