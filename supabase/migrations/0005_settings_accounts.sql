-- PR-OS settings support: list user accounts (profiles joined to auth.users)
-- for the admin account-management screen. auth.users is not exposed to
-- PostgREST, so a SECURITY DEFINER function returns the joined view, gated to
-- admins inside the function body.

create or replace function public.get_accounts()
returns table (
  id uuid,
  email text,
  role app_role,
  person_id uuid,
  display_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, u.email::text, p.role, p.person_id, p.display_name
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.current_app_role() = 'admin'
  order by u.email;
$$;

revoke all on function public.get_accounts() from public;
grant execute on function public.get_accounts() to authenticated;
