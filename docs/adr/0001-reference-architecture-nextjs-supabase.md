# ADR 0001: Reference Architecture Uses Next.js And Supabase

## Status

Accepted for Phase 0 handoff

## Context

The organization does not currently have a dedicated server available. The system should be cloud-first for the early phases while remaining portable enough to move to self-hosting or another backend later.

The system needs authentication, database, private file storage, role-aware access, auditability, and notification jobs. The expected workload is moderate: 5-20 backend users, 10-50 assignees, 1-5 display screens, and 50-300 events per month.

## Decision

Use Next.js as the frontend/application framework and Supabase/PostgreSQL as the reference backend for Phase 1.

## Consequences

Benefits:

- Fast path to auth, database, storage, and RLS
- Good fit for cloud-first deployment
- PostgreSQL keeps the data model portable
- Next.js can support responsive web, monitor pages, API routes, and server-side logic

Tradeoffs:

- Supabase RLS requires careful testing
- LINE/Email jobs need a reliable scheduler
- Avoid tight coupling by keeping data access behind small modules

## Portability Rule

The UI should not call Supabase directly from every component. Data access should be grouped in `src/lib/*` modules so future developers can replace Supabase with another backend without rewriting all screens.
