-- PR-OS initial schema draft for developer handoff.
-- Review RLS policies with the real Supabase project before storing production data.

create extension if not exists "pgcrypto";

create type event_status as enum ('draft', 'published', 'completed', 'canceled');
create type urgency_level as enum ('normal', 'important', 'urgent');
create type assignment_status as enum ('assigned', 'removed');
create type notification_channel as enum ('line', 'email');
create type notification_status as enum ('queued', 'sent', 'failed', 'skipped');
create type notification_type as enum ('assignment', 'reminder', 'change', 'cancellation');

create table public.people (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  position text,
  email text,
  line_user_id text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  is_active boolean not null default true
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default true
);

create table public.event_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default 'blue',
  is_active boolean not null default true
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  color text not null default 'blue',
  is_active boolean not null default true
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date not null,
  start_time time not null,
  end_time time,
  location_id uuid references public.locations(id),
  owner_department_id uuid references public.departments(id),
  event_type_id uuid references public.event_types(id),
  intake_channel text not null,
  source_reference text,
  status event_status not null default 'draft',
  urgency urgency_level not null default 'normal',
  short_note text,
  internal_note text,
  metadata jsonb not null default '{}',
  published_at timestamptz,
  canceled_at timestamptz,
  cancellation_reason text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  person_id uuid not null references public.people(id),
  role_id uuid not null references public.roles(id),
  assignment_status assignment_status not null default 'assigned',
  assignment_version integer not null default 1,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  removed_at timestamptz
);

create table public.acknowledgements (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id),
  assignment_version integer not null,
  acknowledged_by uuid not null references public.people(id),
  acknowledged_at timestamptz not null default now(),
  acknowledgement_channel text not null default 'web',
  user_agent text,
  ip_address inet,
  unique (assignment_id, assignment_version, acknowledged_by)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  summary text not null,
  old_values jsonb not null default '{}',
  new_values jsonb not null default '{}',
  request_id uuid
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id),
  assignment_id uuid references public.assignments(id),
  person_id uuid references public.people(id),
  channel notification_channel not null,
  notification_type notification_type not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status notification_status not null default 'queued',
  provider_message_id text,
  error_message text,
  quota_month text,
  created_at timestamptz not null default now()
);

create table public.settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.display_tokens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  token_hash text not null,
  allowed_scope text not null default 'monitor',
  is_active boolean not null default true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index events_schedule_idx on public.events (event_date, start_time, status);
create index assignments_event_idx on public.assignments (event_id);
create index assignments_person_idx on public.assignments (person_id);
create index notifications_due_idx on public.notifications (status, scheduled_for);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, changed_at desc);

create view public.v_assignment_ack_status as
select
  a.id as assignment_id,
  a.event_id,
  a.person_id,
  a.role_id,
  a.assignment_version,
  case when ack.id is null then 'pending' else 'acknowledged' end as ack_status,
  ack.acknowledged_at
from public.assignments a
left join public.acknowledgements ack
  on ack.assignment_id = a.id
 and ack.assignment_version = a.assignment_version
where a.assignment_status = 'assigned';

alter table public.people enable row level security;
alter table public.departments enable row level security;
alter table public.locations enable row level security;
alter table public.event_types enable row level security;
alter table public.roles enable row level security;
alter table public.events enable row level security;
alter table public.assignments enable row level security;
alter table public.acknowledgements enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.settings enable row level security;
alter table public.display_tokens enable row level security;

-- RLS policy details depend on how the real app maps auth.users to people/roles.
-- Keep service-role operations on the server only.
