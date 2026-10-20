-- 0015 · Notification scheduler on Supabase (pg_cron + pg_net)
--
-- Why: the GitHub Actions schedule (.github/workflows/notifications.yml) is
-- best-effort. On 20 Oct 2026 it was set to every 15 minutes but GitHub ran it
-- once in the whole afternoon, so queued LINE messages waited for hours.
-- New / changed / cancelled jobs now go out straight from the web app
-- (src/lib/notifications/kick.ts). This job covers the timed parts: the 07:00
-- summary, the 1.5-hour reminder and the 17:00 admin report.
--
-- Every 5 minutes, 06:00–20:55 Bangkok (= 23:00–13:55 UTC). The endpoint takes
-- a lock, so this, the GitHub workflow (kept as a backup) and the admin's
-- "ประมวลผลคิว" button never send the same message twice.
--
-- The shared secret is NOT in this file. Store it once in Supabase Vault, with
-- exactly the same value as NOTIFICATIONS_CRON_SECRET on Vercel:
--   select vault.create_secret('<the value>', 'notifications_cron_secret');
-- Until it exists the call is rejected with 401 and nothing is sent.
--
-- Check:   select * from cron.job_run_details order by start_time desc limit 5;
--          select status_code, content from net._http_response order by created desc limit 5;
-- Undo:    select cron.unschedule('pr-os-notifications');

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-runnable: drop an older copy of the job first.
select cron.unschedule(jobid) from cron.job where jobname = 'pr-os-notifications';

select cron.schedule(
  'pr-os-notifications',
  '*/5 23,0-13 * * *',
  $$
  select net.http_post(
    url := 'https://pr-os1.vercel.app/api/notifications/process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notifications-secret',
      coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'notifications_cron_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
