# Handoff Checklist

## Before Development Starts

- Confirm project name or keep `PR-OS` as temporary name
- Confirm actual user list and roles
- Confirm master data: people, departments, locations, event types, roles, intake channels
- Confirm LINE Official Account ownership and access
- Confirm Email sending provider
- Confirm Supabase project owner and billing responsibility
- Confirm backup expectations
- Confirm who approves production launch

## Documents To Read

- `README.md`
- `docs/01-vision-and-scope.md`
- `docs/02-requirements-prd.md`
- `docs/03-user-flows.md`
- `docs/04-data-model.md`
- `docs/05-api-contract.md`
- `docs/06-ui-screens.md`
- `docs/07-implementation-plan.md`
- `docs/08-security-and-permissions.md`
- `docs/09-notification-design.md`

## Prototype Review Checklist

- Monitor readable on office display
- Schedule table easier than current board
- Event form can be completed in 1-2 minutes
- Assignee mobile page is clear
- Ack status is visible to supervisor
- Reports answer real management questions
- No private details appear on monitor

## Database Checklist

- Apply schema to development Supabase
- Add RLS before storing real data
- Seed master data
- Test private attachment access
- Test audit log insert path
- Test display token access

## Notification Checklist

- Create LINE Official Account channel
- Store LINE token securely
- Add monthly quota setting
- Add Email provider credentials
- Test assignment notification
- Test change notification
- Test cancellation notification
- Test fallback when LINE disabled

## Security Checklist

- No service role key in client code
- No public attachment bucket for sensitive files
- No public monitor feed without display token
- Audit log cannot be edited from UI
- Role checks exist on server operations
- Daily backup configured and restore tested

## Launch Checklist

- Pilot with small group first
- Import master data
- Add first 1-2 weeks of real events manually
- Compare with current board daily
- Gather feedback from staff and assignees
- Fix workflow pain before expanding reports
- Review LINE quota after first month
