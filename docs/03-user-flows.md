# User Flows

## Flow 1: Manual Intake To Published Event

1. Staff receives work from official letter, LINE, phone, walk-in, or another channel
2. Staff opens "เพิ่มงาน"
3. Staff enters title, date, time, location, owner department, event type, intake channel, short note, internal note, and attachments
4. Staff adds assignees and roles
5. Staff saves as draft
6. Supervisor reviews required fields and assignment
7. Supervisor publishes event
8. Published event appears on schedule and monitor
9. Notification job queues messages for assigned people

## Flow 2: Assignee Acknowledgement

1. Assignee receives LINE or Email notification
2. Assignee opens secure web link or logs into mobile page
3. Assignee sees assigned event details, role, date/time, location, and attachment links allowed by permission
4. Assignee presses "รับทราบ"
5. System stores acknowledgement timestamp and assignment version
6. Schedule, detail page, and monitor update acknowledgement status

## Flow 3: Significant Change

1. Staff or supervisor edits a published event
2. System compares changed fields with previous version
3. If title, date, time, location, or assignees changed, system marks the event as `has_changes`
4. System writes audit log with old value and new value
5. For affected assignees, acknowledgement resets to pending
6. Notification job queues change notification
7. Monitor shows change indicator until supervisor clears or event date passes

## Flow 4: Cancellation

1. Supervisor opens event detail
2. Supervisor selects cancel
3. System requires cancellation reason
4. Event status changes to `canceled`
5. Audit log stores who canceled and why
6. Notification job queues cancellation message for assignees
7. Monitor can show canceled events for a short configured window or hide them depending on setting

## Flow 5: Monitor Operation

1. Display device opens monitor URL with display token
2. System validates token and returns monitor-safe fields only
3. Monitor shows published events grouped by today, tomorrow, and upcoming
4. Page refreshes data every 30-60 seconds
5. If token is revoked, monitor stops receiving data

## Flow 6: Management Report

1. Executive or supervisor opens reports page
2. User chooses date range and optional filters
3. System calculates KPI cards and chart/table summaries
4. Smart Summary describes the key changes in plain Thai
5. User exports PDF or Excel

## Flow 7: Master Data Maintenance

1. Admin opens settings
2. Admin manages people, departments, locations, event types, roles, notification templates, and display tokens
3. System prevents deleting master data currently used by events
4. Admin can deactivate old values instead of deleting

## Role Matrix

| Capability | Admin | Supervisor | Staff | Assignee | Display |
| --- | --- | --- | --- | --- | --- |
| Manage users and settings | Yes | No | No | No | No |
| Create draft event | Yes | Yes | Yes | No | No |
| Publish event | Yes | Yes | Optional | No | No |
| Edit published event | Yes | Yes | Limited | No | No |
| Cancel event | Yes | Yes | No | No | No |
| View private attachments | Yes | Yes | Yes | Assigned only | No |
| Acknowledge assignment | No | If assigned | If assigned | Yes | No |
| View monitor | Yes | Yes | Yes | Optional | Token only |
| View reports | Yes | Yes | Limited | No | No |
| View audit logs | Yes | Yes | Limited | No | No |
