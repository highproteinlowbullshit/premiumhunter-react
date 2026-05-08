-- ── Heartbeat monitor cron job ────────────────────────────────────────────────
-- Run once in the Supabase SQL editor (or via supabase db push).
-- Schedules the heartbeat-monitor edge function to fire daily at 08:00 UTC —
-- well after the nightly IV batch finishes (23:00–01:37 UTC) and before
-- US market open (13:30 UTC).
--
-- Prerequisites:
--   1. pg_cron and pg_net extensions must be enabled in your Supabase project.
--   2. Set CRON_SECRET in the edge function secrets (Dashboard → Edge Functions → Secrets).
--   3. Replace <PROJECT_REF> and <CRON_SECRET> with your actual values.
--      Your project ref is in the Supabase dashboard URL:
--        https://supabase.com/dashboard/project/<PROJECT_REF>
-- ─────────────────────────────────────────────────────────────────────────────

SELECT cron.schedule(
  'heartbeat-monitor-daily',              -- unique job name
  '0 8 * * *',                            -- every day at 08:00 UTC
  $$
  SELECT net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/heartbeat-monitor',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

-- To verify the job was created:
-- SELECT * FROM cron.job WHERE jobname = 'heartbeat-monitor-daily';

-- To remove the job:
-- SELECT cron.unschedule('heartbeat-monitor-daily');

-- ── Required edge function secrets (set in Supabase Dashboard) ────────────────
-- RESEND_API_KEY     — your Resend API key (https://resend.com/api-keys)
-- ALERT_EMAIL_FROM   — verified sender, e.g. "PremiumHunter Alerts <alerts@yourdomain.com>"
--                      (domain must be verified in Resend; for testing you can use
--                       the Resend sandbox from address while sending to your own email)
-- ALERT_EMAIL_TO     — recipient, defaults to branyzp@gmail.com if not set
-- CRON_SECRET        — a random secret string shared between this SQL and the edge function
