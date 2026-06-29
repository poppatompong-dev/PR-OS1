# Notification Design

## Channel Strategy

Primary channel: LINE Messaging API for assigned people

Fallback channel: Email

Reasoning:

- LINE is closer to existing user behavior
- Free quota may be enough for pilot if scoped tightly
- Email is easier to keep as fallback and official-friendly

## Free Quota Guard

Design assumptions:

- Count LINE messages by recipient
- Send only to assigned people
- Avoid broadcast to everyone
- Queue one reminder before event by default
- Track monthly usage in `notifications`
- Stop or switch to Email before quota is exceeded

## Notification Types

### Assignment

Sent when event is published and assignee is assigned.

Message should include:

- Event title
- Date/time
- Location
- Role
- Link to acknowledge

### Reminder

Sent before event.

Default timing:

- 1 day before for normal events
- 1 hour before for same-day operational reminder if enabled

### Change

Sent when significant fields change:

- title
- date
- time
- location
- assignee

### Cancellation

Sent when event is canceled.

Must include cancellation reason if safe to share.

## Acknowledgement Flow

Acknowledgement should happen via web, not LINE reply.

Reasons:

- Easier to secure
- Easier to store assignment version
- Avoids depending on LINE webhook complexity in MVP

## Template Examples

### Assignment LINE Template

```text
แจ้งมอบหมายงานประชาสัมพันธ์
งาน: {eventTitle}
วันที่: {eventDate} เวลา {startTime}
สถานที่: {location}
บทบาท: {role}
กรุณากดรับทราบ: {ackUrl}
```

### Change Template

```text
มีการเปลี่ยนแปลงงานประชาสัมพันธ์
งาน: {eventTitle}
เปลี่ยนแปลง: {changeSummary}
กรุณาตรวจสอบและรับทราบใหม่: {ackUrl}
```

### Cancellation Template

```text
ยกเลิกงานประชาสัมพันธ์
งาน: {eventTitle}
วันที่เดิม: {eventDate} เวลา {startTime}
เหตุผล: {cancellationReason}
```

## Queue Rules

- Notification creation and sending are separate steps
- Event mutation creates queued notifications
- Background job sends due notifications
- Failed notification stores error and can be retried
- Duplicate protection uses event, assignment, notification type, and assignment version

## Admin Settings

Recommended settings:

- `line_enabled`
- `email_enabled`
- `line_monthly_quota`
- `default_reminder_hours`
- `same_day_reminder_enabled`
- `fallback_to_email_when_line_fails`
- `fallback_to_email_when_quota_exceeded`
