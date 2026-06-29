# Requirements PRD

## Problem Statement

ฝ่ายประชาสัมพันธ์รับงานจากหลายช่องทางและใช้กระดานภายในเป็นแหล่งรวมข้อมูลหลัก ทำให้เกิดปัญหาการถามซ้ำ งานตกหล่น การแก้ไขไม่มีหลักฐาน และผู้ปฏิบัติงานบางคนไม่ทราบหรือไม่ยืนยันว่าได้รับมอบหมายแล้ว ผู้บริหารต้องการรายงานสรุปที่เชื่อถือได้โดยไม่ต้องรวบรวมมือทุกครั้ง

## Solution

สร้างระบบ PR-OS สำหรับบันทึกงานประชาสัมพันธ์ แสดงตารางงานบนจอมอนิเตอร์ มอบหมายผู้รับผิดชอบ รับทราบงาน แจ้งเตือน และสรุปรายงานผู้บริหาร โดยเริ่มจาก manual intake ที่ควบคุมได้ก่อน แล้วค่อยเพิ่ม automation ใน phase ถัดไป

## Actors

- Admin: จัดการผู้ใช้ master data และ settings
- Supervisor/Reviewer: ตรวจ แก้ เผยแพร่ ยกเลิกงาน ดูรายงาน
- Staff: บันทึกและแก้ไขงานตามสิทธิ์
- Assignee: ดูงานของตนเองและกดรับทราบ
- Display: จอมอนิเตอร์ที่เข้าด้วย display token
- Executive: ดูรายงานสรุปและ export

## User Stories

1. As a staff, I want to add a PR work item with date, time, location, department, owner, assignees, roles, notes, and attachments, so that all operational details are captured in one place.
2. As a staff, I want to mark the intake channel, so that the team can trace whether the work came from official letter, LINE, phone, walk-in, or another source.
3. As a supervisor, I want to publish only reviewed work items, so that the monitor does not show incomplete drafts.
4. As an assignee, I want to see my assigned work on mobile, so that I can prepare without returning to the office monitor.
5. As an assignee, I want to acknowledge an assignment, so that the supervisor knows I have seen it.
6. As a supervisor, I want to see unacknowledged assignments, so that I can follow up before the event date.
7. As a staff, I want to edit event date, time, place, title, and assignees, so that changes from the source agency can be reflected quickly.
8. As a supervisor, I want significant changes to trigger re-notification and reset acknowledgement for affected assignees, so that people do not rely on outdated details.
9. As a supervisor, I want cancellation with a reason instead of hard delete, so that the history remains available.
10. As a display viewer, I want the monitor to show today, tomorrow, and next 7 days, so that the team can scan upcoming work quickly.
11. As a display viewer, I want the monitor to hide personal phone numbers and sensitive internal notes, so that the office can keep the screen visible safely.
12. As an executive, I want daily, weekly, and monthly summary reports, so that I can understand workload and operational status quickly.
13. As an executive, I want export to PDF and Excel, so that reports can be attached to official communication.
14. As an admin, I want configurable master data, so that departments, locations, event types, and roles can be updated without code changes.
15. As a supervisor, I want audit logs for edits, so that I can answer who changed what and when.
16. As a staff, I want attachments to be private, so that working documents are not exposed publicly.
17. As a supervisor, I want notification history, so that failed or repeated notifications can be reviewed.
18. As an admin, I want LINE quota guard and Email fallback, so that free-tier messaging can be controlled.

## Functional Requirements

### Event Management

- Create, edit, publish, complete, cancel, and soft delete events
- Required fields: title, date, start time, location, owner department, intake channel
- Optional fields: end time, short note, internal note, contact name, source reference, event type, urgency, attachments
- Significant fields: title, date, time, location, assignees
- Configurable metadata for fields that may change later

### Assignment And Acknowledgement

- Assign one or more people per event
- Each assignment has a role such as MC, photographer, coordinator, owner, support
- Assignee can acknowledge via responsive web
- System stores acknowledgement timestamp, device/user context, and current assignment version

### Monitor Display

- Shows published events only
- Default range: today, tomorrow, next 7 days
- Auto refresh every 30-60 seconds
- Shows event title, date/time, location, owner department, assigned roles, acknowledgement status, short note
- Hides private attachments, phone numbers, internal notes, and audit details

### Notification

- LINE primary for assigned people where available
- Email fallback or parallel channel
- Send once before event by default
- Notification timing configurable, such as 1 day or 1 hour before
- Count LINE messages by recipient and track monthly quota

### Reporting

- KPI: total events by period
- KPI: events by type and owner department
- KPI: workload by person and role
- KPI: unacknowledged assignments
- KPI: changed or canceled work
- KPI: today, week, and month summary
- Export PDF/Excel

## Non-Functional Requirements

- Backend page load target: 1-2 seconds for normal filters
- Save target: 1-2 seconds for typical event
- Monitor refresh: 30-60 seconds
- Notification delivery: asynchronous, acceptable within 1-5 minutes
- Monthly scale target: 50-300 events, 5-20 backend users, 10-50 assignees, 1-5 monitors
- Attachments: 1-5 files per event in MVP
- Daily backup minimum

## Acceptance Criteria

- Staff can enter a normal event in 1-2 minutes
- Monitor shows the same operational information as the current board, but clearer
- Supervisor can identify unacknowledged work within one screen
- Significant edit creates audit log and queues notification
- Assignee can open mobile page and acknowledge work
- Executive report can be generated for a selected date range
- Private attachment cannot be accessed without permission
