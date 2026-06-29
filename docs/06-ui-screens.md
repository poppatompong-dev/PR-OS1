# UI Screens

## Design Direction

Theme: ราชการยุคใหม่ สวยแบบระบบงานมืออาชีพ

Guidelines:

- พื้นสว่าง อ่านง่าย
- ตัวอักษรใหญ่กว่าระบบราชการทั่วไป
- ใช้แนว command-center สำหรับงานปฏิบัติการ: sidebar เข้ม, surface สว่าง, status color ชัด, และจอมอนิเตอร์แบบ ops wall
- ใช้น้ำเงิน เขียวอมฟ้า เขียว เหลืองอำพัน แดง และเทาอ่อนเป็น semantic palette เพื่อไม่ให้หน้าจอเป็นสีเดียวจนแบน
- สีสถานะต้องชัด: รอรับทราบ, เปลี่ยนแปลง, ยกเลิก, ด่วน
- ตารางแน่นพอดี แต่ไม่อึดอัด
- จอมอนิเตอร์ต้องอ่านจากระยะไกลได้
- Backend ต้องกรอกงานเร็ว ไม่สวยจนทำงานช้า
- ใช้ไอคอน Lucide สำหรับ navigation และ action สำคัญ แทน emoji หรือไอคอนวาดเอง
- ต้องมี motion layer ที่ดูตั้งใจ ไม่ใช่ static template: entrance, row stagger, live status pulse, monitor refresh sweep, pressed feedback
- Animation ต้องมีความหมายกับสถานะหรือ interaction และต้องเคารพ `prefers-reduced-motion`

## Screen 1: Monitor

Route: `/monitor`

Purpose: operational display in PR office.

Shows:

- Date and current refresh time
- Live ticker for published event highlights and operational notices
- Today, Tomorrow, Next 7 Days sections
- Event time, title, location, owner department
- Assigned roles and people
- Ack status summary
- Short note

Hides:

- Phone numbers
- Internal notes
- Private attachments
- Audit details

## Screen 2: Schedule Table

Route: `/schedule`

Purpose: main working table for staff and supervisor.

Controls:

- Search
- Date range filter
- Status filter
- Department filter
- Assignee filter
- Ack status filter
- Add event button

Table columns:

- Date/time
- Event
- Location
- Department
- Assignees/roles
- Ack status
- Status
- Change flag

## Screen 3: Event Entry Form

Route: `/events/new`

Sections:

- Main info
- Date/time and location
- Owner and intake channel
- Assignments and roles
- Attachments
- Notification setting
- Notes

Rules:

- Required fields are clear
- Save draft is available
- Publish requires validation
- Custom fields can appear in a separate section later

## Screen 4: Event Detail

Route: `/events/sample-event`

Purpose:

- View complete event details
- See assignments and acknowledgement
- See change history
- Edit, publish, complete, or cancel based on permission

## Screen 5: Mobile My Tasks

Route: `/mobile/my-tasks`

Purpose:

- Assignee sees assigned work
- Acknowledge with one clear action
- Read event detail and attachment summary

Mobile priorities:

- Big date/time
- Role badge
- Location
- Acknowledge button
- Change warning

## Screen 6: Reports

Route: `/reports`

Purpose:

- Management summary
- KPI cards
- workload table
- smart summary text
- export PDF/Excel action

KPI cards:

- Total events
- Published events
- Pending acknowledgements
- Changed/canceled events
- Workload top person
- Upcoming today

## Screen 7: Settings

Route: `/settings`

Purpose:

- Master data overview
- Staff management with add, deactivate/reactivate, and remove controls
- Notification settings
- Display token management
- Backup and export settings

## Prototype Behavior

The included Next.js pages use mock data only. They are meant to support review conversations with users and programmers. When moving to implementation, replace `src/data/mock-data.ts` with Supabase-backed data access functions while keeping route responsibilities close to this screen spec.

## Redesign Notes

Current mock UI has been redesigned toward an operations command center:

- Dashboard has a command strip and readiness panel
- Dashboard has an immersive visual stage inspired by a coral/blue fluid web design reference
- Sidebar includes icons and pilot status
- Metric cards use semantic color accents
- Schedule table uses icon-supported metadata and clearer row hierarchy
- Monitor page is optimized for a large dark display with high contrast
- Monitor page includes a live ticker, subtle sparkle points, and glint motion for operational energy
- Mobile page uses larger cards and clearer acknowledge action
- Motion layer added to avoid static/AI-template feel: dashboard entrance, metric card hover, table row stagger, attention pulse for important statuses, monitor refresh sweep, and live rail pulse
