-- supabase/cron-setup.sql
-- Reference SQL for setting up pg_cron + pg_net to call calculate-iv-rank nightly.
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor).
--
-- Prerequisites (Dashboard → Database → Extensions):
--   1. Enable pg_cron
--   2. Enable pg_net
--
-- 98 jobs (batchIndex 0–97), one per minute starting at 23:00 UTC.
-- Each job processes 5 tickers; 98 jobs × 5 = 488 tickers covered in ~1h 38m.

DO $$
DECLARE
  i          INT;
  hour_utc   INT;
  minute_utc INT;
BEGIN
  FOR i IN 0..97 LOOP
    -- Spread jobs: starts at 23:00, increments 1 minute each batch.
    -- Rolls over midnight: batches 60–97 land at 00:00–00:37 UTC.
    hour_utc   := CASE WHEN i < 60 THEN 23 ELSE 0 END;
    minute_utc := CASE WHEN i < 60 THEN i  ELSE i - 60 END;

    PERFORM cron.schedule(
      'iv-rank-batch-' || i,
      minute_utc || ' ' || hour_utc || ' * * *',
      format(
        'SELECT net.http_post(url := %L, body := %L::jsonb, headers := %L::jsonb)',
        'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/calculate-iv-rank',
        '{"batchIndex":' || i || '}',
        '{"Content-Type":"application/json","Authorization":"Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525"}'
      )
    );
  END LOOP;
END;
$$;

-- To verify all 98 jobs were created:
-- SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'iv-rank-batch-%' ORDER BY jobname;

-- To remove all jobs (if you need to re-run setup):
-- DO $$ DECLARE r RECORD; BEGIN FOR r IN SELECT jobname FROM cron.job WHERE jobname LIKE 'iv-rank-batch-%' LOOP PERFORM cron.unschedule(r.jobname); END LOOP; END; $$;
