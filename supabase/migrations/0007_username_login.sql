-- PR-OS username login. Supabase Auth is email-based, so we keep the auth email
-- but let users sign in with a short username. profiles.username maps to the
-- account; the login server action resolves username -> email via
-- get_login_email() (run server-side, so the email is never exposed to the browser).

alter table public.profiles add column if not exists username text unique;

-- Resolve a username to its account email (used only inside the login server action).
create or replace function public.get_login_email(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.email::text
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username = lower(p_username)
  limit 1;
$$;

revoke all on function public.get_login_email(text) from public;
grant execute on function public.get_login_email(text) to anon, authenticated;

-- Account list for settings now includes username (return type changed -> drop first).
drop function if exists public.get_accounts();
create function public.get_accounts()
returns table (
  id uuid,
  email text,
  username text,
  role app_role,
  person_id uuid,
  display_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, u.email::text, p.username, p.role, p.person_id, p.display_name
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.current_app_role() = 'admin'
  order by coalesce(p.username, u.email);
$$;

revoke all on function public.get_accounts() from public;
grant execute on function public.get_accounts() to authenticated;
