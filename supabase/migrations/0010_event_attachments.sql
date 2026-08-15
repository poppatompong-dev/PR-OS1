-- 0010: private event attachments.
--
-- Files live in a PRIVATE Supabase Storage bucket ('event-attachments');
-- public.event_attachments holds the metadata the app queries (file name,
-- size, uploader) so listing attachments never needs a Storage admin call.
--
-- Access model (mirrors events/assignments in 0002):
--   admin/supervisor/staff  -> read + upload + delete
--   assignee                -> read only, and only for events assigned to them
--   anon / display / monitor-> no access at all (monitor feed never joins here)
--
-- Downloads are served through short-lived signed URLs created server-side by
-- the user's own session (src/app/api/attachments/[id]/route.ts), so no
-- service-role key is needed and Storage RLS stays the enforcement point.

-- =========================================================================
-- 1. Metadata table
-- =========================================================================

create table if not exists public.event_attachments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists event_attachments_event_idx
  on public.event_attachments (event_id)
  where deleted_at is null;

alter table public.event_attachments enable row level security;

drop policy if exists event_attachments_read on public.event_attachments;
create policy event_attachments_read on public.event_attachments for select
  using (
    public.current_app_role() in ('admin', 'supervisor', 'staff')
    or exists (
      select 1 from public.assignments a
      where a.event_id = event_attachments.event_id
        and a.person_id = public.current_person_id()
        and a.assignment_status = 'assigned'
    )
  );

drop policy if exists event_attachments_write on public.event_attachments;
create policy event_attachments_write on public.event_attachments for all
  using (public.current_app_role() in ('admin', 'supervisor', 'staff'))
  with check (public.current_app_role() in ('admin', 'supervisor', 'staff'));

-- =========================================================================
-- 2. Private storage bucket
-- =========================================================================
-- 10 MB per file keeps the free-tier 1 GB bucket usable for a pilot.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-attachments',
  'event-attachments',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- =========================================================================
-- 3. Storage RLS
-- =========================================================================
-- Object names are '<event_id>/<uuid>.<ext>', so the owning event is the first
-- path segment. Parsing is wrapped so a malformed name yields null (no access)
-- instead of raising inside a policy.

create or replace function public.attachment_event_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception
  when others then
    return null;
end;
$$;

drop policy if exists event_attachments_object_read on storage.objects;
create policy event_attachments_object_read on storage.objects for select
  to authenticated
  using (
    bucket_id = 'event-attachments'
    and (
      public.current_app_role() in ('admin', 'supervisor', 'staff')
      or exists (
        select 1 from public.assignments a
        where a.event_id = public.attachment_event_id(storage.objects.name)
          and a.person_id = public.current_person_id()
          and a.assignment_status = 'assigned'
      )
    )
  );

drop policy if exists event_attachments_object_insert on storage.objects;
create policy event_attachments_object_insert on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-attachments'
    and public.current_app_role() in ('admin', 'supervisor', 'staff')
    and public.attachment_event_id(storage.objects.name) is not null
  );

drop policy if exists event_attachments_object_delete on storage.objects;
create policy event_attachments_object_delete on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'event-attachments'
    and public.current_app_role() in ('admin', 'supervisor', 'staff')
  );
