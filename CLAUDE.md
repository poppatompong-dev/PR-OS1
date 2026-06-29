# CLAUDE.md

คู่มือนี้เป็นคำสั่งและบริบทสำหรับ Claude Code, Codex, หรือ agent อื่นที่เข้ามาพัฒนาต่อใน repository `PR-OS`.

PR-OS คือระบบบริหารจัดการงานประชาสัมพันธ์ของหน่วยงานเทศบาล มีเป้าหมายให้ฝ่ายประชาสัมพันธ์บันทึกงาน, มอบหมายผู้รับผิดชอบ, แสดงตารางงานบนจอมอนิเตอร์, รับทราบงานผ่านมือถือ, แจ้งเตือน, และสรุปรายงานผู้บริหารได้จากระบบเดียว

สถานะปัจจุบัน: **Phase 0 developer handoff**  
ยังเป็น prototype/mock data + เอกสารออกแบบ + schema draft ยังไม่ใช่ production และยังไม่เชื่อม Supabase จริง

## Quick Start For Agents

ก่อนแก้โค้ดทุกครั้ง ให้อ่านเอกสารตามลำดับนี้:

1. `README.md` - ภาพรวม project, stack, วิธีรัน
2. `docs/01-vision-and-scope.md` - วิสัยทัศน์และขอบเขต
3. `docs/02-requirements-prd.md` - requirement หลักและ acceptance criteria
4. `docs/04-data-model.md` - data model และ master data
5. `docs/05-api-contract.md` - intended API behavior
6. `docs/06-ui-screens.md` - screen specification
7. `docs/07-implementation-plan.md` - roadmap การพัฒนาต่อ
8. `docs/12-visual-design-direction.md` - visual direction, motion, typography

ถ้าคำขอเกี่ยวกับ notification ให้อ่าน `docs/09-notification-design.md` เพิ่มด้วย  
ถ้าคำขอเกี่ยวกับ security/permission ให้อ่าน `docs/08-security-and-permissions.md` เพิ่มด้วย  
ถ้าคำขอเกี่ยวกับส่งมอบหรือ handoff ให้อ่าน `docs/10-handoff-checklist.md` เพิ่มด้วย

## Current Tech Stack

- Framework: Next.js App Router
- Language: TypeScript
- UI: React + global CSS in `src/app/globals.css`
- Icons: `lucide-react`
- Data source now: mock data in `src/data/mock-data.ts`
- Backend target: Supabase Auth, PostgreSQL, Storage, RLS
- DB draft: `supabase/migrations/0001_initial_schema.sql`
- Seed draft: `supabase/seed.sql`

## Local Commands

```bash
npm install
npm run dev
npm run build
npm run typecheck
```

Notes:

- `npm run lint` is defined, but confirm Next.js lint compatibility before depending on it.
- If `npm run build` is executed while `npm run dev` is still running, restart the dev server afterward. Next.js generated `.next` cache can cause dev CSS asset paths such as `/_next/static/css/app/layout.css` to return 404, making the page look like raw HTML.
- For Windows, prefer `npm.cmd` in automation commands when available.

Recommended safe loop:

```bash
# Stop dev server if running
npm.cmd run build

# After build verification, restart dev server for visual QA
npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
```

## Repository Hygiene

Do not commit local/generated/heavy files.

Ignored intentionally:

- `.next/`
- `node_modules/`
- `.agents/`
- `.backup/`
- `models/`
- `*.mp3`
- `*.wav`
- `*.docx`
- raw files under `transcripts/`
- local logs and build info

Allowed transcript file:

- `transcripts/interview_summary.md`

Reason: raw audio, raw transcripts, local whisper models, and Word interview files are local working artifacts, may be large, and may contain sensitive information.

Before commit/push:

```bash
git status --short
git status --short --ignored
git ls-files
npm.cmd run build
```

Verify that no `models/`, audio files, `.docx`, `.next/`, or `node_modules/` are staged.

## Product Goal

The system should replace the current fragmented workflow where PR work arrives through multiple channels and is tracked manually on a board.

Main outcomes:

- One operational source of truth for PR work
- Clear assignment by person and role
- Mobile acknowledgement by assignees
- Monitor-safe display for office screen
- Audit trail for significant changes
- Notification history and quota control
- Management reports that can be trusted and exported

## Primary Actors

- Admin: manages users, master data, system settings
- Supervisor/Reviewer: reviews, edits, publishes, cancels, reports
- Staff: creates and maintains event records
- Assignee: sees assigned tasks and acknowledges
- Display: monitor view using display token
- Executive: reads summary reports and exports PDF/Excel

## MVP Scope

MVP should include:

- Manual event intake
- Event draft/publish/cancel/complete
- Assignment and acknowledgement
- Monitor display
- Basic notification queue
- LINE primary with Email fallback design
- Reports and export design
- Master data management
- Audit log
- Private attachment design

MVP should not include:

- Automatic LINE group ingestion
- OCR official letters
- AI document/audio analysis inside production system
- Native mobile app
- Public monitor URL
- Overly complex permission model

## Current Routes

Prototype routes:

- `/` - dashboard overview
- `/monitor` - operational monitor
- `/schedule` - schedule table
- `/events/new` - new event form
- `/events/sample-event` - sample detail
- `/mobile/my-tasks` - assignee mobile view
- `/reports` - management reports
- `/settings` - master data/settings prototype

Keep route responsibilities aligned with `docs/06-ui-screens.md`.

## Data Model Rules

Core tables in the target system:

- `people`
- `departments`
- `locations`
- `event_types`
- `roles`
- `events`
- `assignments`
- `acknowledgements`
- `notifications`
- `audit_logs`
- `settings`
- `display_tokens`

Important rules:

- Use real columns for fields needed for filtering/reporting.
- Use `metadata` only for flexible fields that are not core filters.
- Do not hard-delete operational records that may be referenced.
- Master data should support deactivate/reactivate.
- Audit logs should be append-only.
- Attachments are private by default.
- Monitor view must never expose private/internal fields.

## Staff Master Data

Initial pilot staff list:

- นางสาวภนิตา ชะรัดรัมย์ - รักษาการในตำแหน่ง หัวหน้าฝ่ายบริการและเผยแพร่วิชาการ
- นายธนันธร พันธุ์รอด - หัวหน้างานประชาสัมพันธ์
- นายประชารักษ์ ประทุมโทน - นักประชาสัมพันธ์ปฏิบัติการ
- นางสาวณัฏฐ์ จิรจีรังชัย - นักประชาสัมพันธ์ปฏิบัติการ
- นางสาวภัททิรา แย้มเผื่อน - พนักงานจ้างทั่วไป
- นางสาวเทียมแข กิจกล้า - พนักงานจ้างทั่วไป

Do not invent real emails or LINE IDs for these people. Keep contact fields blank unless the project owner provides them.

The system must support:

- Add staff
- Edit staff contact info
- Deactivate/reactivate staff
- Hide inactive staff from new assignments
- Preserve historical references in assignments/reports

## Assignment And Acknowledgement Rules

- One event can have multiple assignments.
- Each assignment has one person and one role.
- Acknowledgement is tied to assignment version.
- Significant changes should reset acknowledgement only for affected assignees.
- Significant fields include title, date, time, location, and assignees.
- Acknowledgement should store timestamp and channel/context.

## Monitor Rules

Monitor is office-visible and must be safe by default.

Show:

- Published events only
- Date/time
- Event title
- Location
- Owner department
- Assigned roles/people
- Acknowledgement status summary
- Short note

Hide:

- Phone numbers
- Internal notes
- Private attachment URLs
- Audit log details
- Sensitive contact data

Default range:

- Today
- Tomorrow
- Next 7 days

Refresh target:

- 30-60 seconds

## Notification Rules

Current design:

- LINE primary when available
- Email fallback or parallel channel
- Async queue, not blocking event save/publish
- Track send status and provider message id
- Track monthly LINE quota
- Configurable timing, such as 24 hours or 1 hour before event

LINE free-tier concern:

- Treat LINE quota as constrained.
- Implement quota guard before sending.
- Email fallback should be available if LINE is unavailable or quota is exceeded.

Do not place provider secrets in client-side code.

## Reporting Rules

Reports should be deterministic first, AI later.

Useful KPIs:

- Total events by period
- Published events
- Draft/completed/canceled events
- Workload by person and role
- Unacknowledged assignments
- Changed/canceled work
- Events by owner department/type
- Today/week/month summary

Export:

- PDF
- Excel

Export must respect on-screen filters and should be audit logged.

## UI/UX Direction

The user explicitly wants a beautiful, premium UI, not a generic admin template.

Reference mood:

- Immersive command center
- Coral/peach/deep blue/violet/dark ink accents
- Fluid gradient shapes
- Side rail
- Dotted rhythm
- Dark preview panels
- Meaningful motion

Keep practical constraints:

- This is an operational office system, not a marketing landing page.
- Tables and forms must remain readable.
- Backend workflows must be fast.
- Thai text must be legible at office-monitor distance.
- Do not hide operational data behind decoration.

Motion requirements:

- Hero liquid blobs drift slowly
- Signal sweep in hero/monitor
- KPI cards and rows enter with slight stagger
- Live status dot pulses
- Important/canceled/changed states pulse subtly
- Buttons have pressed feedback
- All animations respect `prefers-reduced-motion`

Avoid:

- AI slop
- Decorative-only animation
- Generic admin template look
- Excessive glass blur
- One-note purple/blue palette everywhere
- Emoji icons as structural UI

## Typography

Use the modern Thai font stack in `src/app/globals.css`.

Current stack:

```css
--font-ui: "LINE Seed Sans TH", "IBM Plex Sans Thai", "Noto Sans Thai", "Leelawadee UI", "Segoe UI", system-ui, sans-serif;
--font-display: "LINE Seed Sans TH", "IBM Plex Sans Thai", "Noto Sans Thai", "Leelawadee UI", "Segoe UI", system-ui, sans-serif;
--font-data: "Cascadia Code", "Segoe UI Mono", Consolas, "Noto Sans Thai", monospace;
```

Typography rules:

- Body text 16px or larger
- No negative letter spacing
- Use tabular numbers for time/KPI/monitor data
- Use heavier heading weights for authority
- Do not import web fonts from CDN unless deployment policy allows it

## Component And Code Style

Follow the existing style unless there is a clear reason to refactor.

Current conventions:

- TypeScript types live in `src/types/domain.ts`
- Mock data lives in `src/data/mock-data.ts`
- Reusable visual components live in `src/components/`
- Routes live under `src/app/`
- Global design tokens and CSS live in `src/app/globals.css`

When adding logic:

- Prefer small domain modules under `src/lib/<domain>/`
- Keep Supabase-specific access behind query/mutation helpers
- Keep UI labels Thai
- Keep code identifiers English
- Avoid putting business logic only in React components
- Avoid unrelated refactors

When adding UI:

- Use Lucide icons where possible
- Keep touch/click targets at least 44px
- Use semantic HTML and visible form labels
- Preserve focus-visible states
- Test desktop and a mobile-sized viewport when changing layout

## Backend Implementation Guidance

Target architecture:

- Next.js App Router
- Supabase Auth
- PostgreSQL with RLS
- Supabase Storage for private attachments
- Route Handlers or Server Actions for mutations

Suggested module layout when implementing real backend:

```text
src/lib/supabase/server.ts
src/lib/supabase/client.ts
src/lib/auth/roles.ts
src/lib/events/queries.ts
src/lib/events/mutations.ts
src/lib/assignments/queries.ts
src/lib/assignments/mutations.ts
src/lib/monitor/queries.ts
src/lib/notifications/queue.ts
src/lib/notifications/line.ts
src/lib/notifications/email.ts
src/lib/reports/queries.ts
src/lib/reports/smart-summary.ts
```

Security rules:

- Service role operations must stay server-side.
- RLS policies must be reviewed before real data entry.
- Display token must only access monitor-safe feed.
- Private attachments must require authorization.
- Changes to events, assignments, staff, notifications, and exports should be audit logged.

## Recommended Development Order

Follow `docs/07-implementation-plan.md`.

Suggested sprints:

1. Project foundation and Supabase setup
2. Event CRUD
3. Assignment and acknowledgement
4. Monitor-safe feed
5. Notifications
6. Reports and export

Do not start with AI/report intelligence before the core workflow works.

## Testing Expectations

At minimum:

- `npm.cmd run build`
- TypeScript validity through Next build
- Manual browser check for styled UI
- Core route smoke test

For frontend visual changes:

- Open `http://127.0.0.1:3000`
- Verify first viewport is styled, not raw HTML
- Verify no framework overlay
- Verify console has no relevant errors
- Verify at least one interaction if the changed page has controls

For database/backend changes:

- Add migration or update existing draft clearly
- Verify RLS implications
- Test authenticated vs unauthenticated behavior
- Test display token restrictions
- Test audit log creation

For notification changes:

- Test queued, sent, failed, skipped statuses
- Test quota guard
- Test fallback behavior
- Do not send real external messages without explicit owner confirmation

## Known Local Dev Issue

Next.js cache issue observed during handoff:

If the dev server is running, then `npm run build` is executed, `.next` may become production-shaped while the dev HTML still points to dev CSS. Symptom:

- Page appears as raw HTML
- CSS is not applied
- `/_next/static/css/app/layout.css` returns 404

Fix:

1. Stop the local Next.js dev server.
2. Remove `.next/`.
3. Start dev again.
4. Verify `/` returns 200.
5. Verify `/_next/static/css/app/layout.css` returns 200.

PowerShell pattern:

```powershell
# Stop node/next processes for this workspace first.
# Then remove only the generated cache inside the workspace.
Remove-Item -LiteralPath .next -Recurse -Force
npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
```

Be careful: never recursively delete a computed path unless you have verified it resolves inside the workspace.

## Git And Delivery

Remote:

```text
https://github.com/poppatompong-dev/PR-OS.git
```

Current branch:

```text
main
```

Recommended commit style:

- `docs: ...`
- `chore: ...`
- `feat: ...`
- `fix: ...`
- `refactor: ...`

Before pushing:

```bash
git status --short
npm.cmd run build
git add .
git status --short
git commit -m "<message>"
git push
```

If build was run while dev server was open, restart dev afterward as described above.

## Skill And Tooling Notes

Recommended agent skills/workflows are documented in `docs/11-recommended-skills.md`.

Important notes:

- `ui-ux-pro-max` is the primary local skill for UI polish and typography/motion checks.
- `product-design:ideate` and `product-design:audit` are useful before/after major redesign.
- `figma:figma-generate-design` can be used if the owner wants editable design output.
- TypeUI is documented as an optional external design-system source only.
- Do not install, enable, or connect TypeUI MCP until the project owner explicitly confirms.
- `design-motion-principles` was identified as a possible external skill for motion review, but should be installed only after owner confirmation.

## Communication Style For Future Agents

The project owner writes mostly in Thai. Reply in Thai unless asked otherwise.

Expected style:

- Be practical and direct.
- Keep the user updated when working for a while.
- Do not stop at theory if the request clearly asks for implementation.
- When changing behavior, update affected docs in the same pass.
- When debugging UI, verify the rendered browser, not only build success.
- When accuracy matters, cite the local file or test result.

## Do Not Do

- Do not commit large local files, raw audio, local models, or generated caches.
- Do not invent official contact data for real staff.
- Do not expose private attachments or internal notes on monitor views.
- Do not bypass audit logging for significant changes.
- Do not put provider secrets in client code.
- Do not make the UI plain/generic if the request is visual work.
- Do not add decorative animation without operational meaning.
- Do not replace documented requirements silently.
- Do not change schema/API contracts without updating `docs/04-data-model.md` and `docs/05-api-contract.md`.
- Do not assume Supabase RLS is production-ready until reviewed against the real project.

## Definition Of Done

For any non-trivial future change, consider the work done only when:

- Code/docs match the requested behavior
- Affected docs are updated
- Build or relevant verification passes
- Rendered UI is checked if UI changed
- No sensitive/local/generated artifacts are staged
- Git status is understood
- The user receives a concise summary with file references and verification evidence
