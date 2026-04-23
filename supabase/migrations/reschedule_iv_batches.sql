-- iv-rank batch schedule: 244 entries, 2 tickers per batch
-- 1. Replace <PROJECT_REF> with your Supabase project ref (e.g. abcdefghijkl)
-- 2. Replace <YOUR_CRON_SECRET> with the CRON_SECRET value from your edge function env vars
-- 3. Run the TEARDOWN block first, confirm job count = 0, then run the SCHEDULE block

-- ══ TEARDOWN ══════════════════════════════════
DO $$
DECLARE
  jobs text[];
  j text;
BEGIN
  SELECT array_agg(jobname) INTO jobs FROM cron.job;
  IF jobs IS NOT NULL THEN
    FOREACH j IN ARRAY jobs LOOP
      PERFORM cron.unschedule(j);
    END LOOP;
  END IF;
END;
$$;

SELECT COUNT(*) AS should_be_zero FROM cron.job;

-- ══ SCHEDULE (run after teardown confirms 0) ══
SELECT cron.schedule(
  'iv-rank-batch-0',
  '0 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 0}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-1',
  '1 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 1}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-2',
  '2 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 2}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-3',
  '3 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 3}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-4',
  '4 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 4}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-5',
  '5 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 5}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-6',
  '6 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 6}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-7',
  '7 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 7}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-8',
  '8 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 8}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-9',
  '9 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 9}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-10',
  '10 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 10}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-11',
  '11 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 11}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-12',
  '12 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 12}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-13',
  '13 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 13}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-14',
  '14 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 14}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-15',
  '15 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 15}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-16',
  '16 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 16}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-17',
  '17 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 17}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-18',
  '18 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 18}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-19',
  '19 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 19}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-20',
  '20 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 20}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-21',
  '21 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 21}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-22',
  '22 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 22}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-23',
  '23 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 23}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-24',
  '24 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 24}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-25',
  '25 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 25}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-26',
  '26 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 26}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-27',
  '27 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 27}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-28',
  '28 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 28}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-29',
  '29 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 29}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-30',
  '30 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 30}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-31',
  '31 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 31}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-32',
  '32 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 32}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-33',
  '33 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 33}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-34',
  '34 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 34}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-35',
  '35 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 35}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-36',
  '36 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 36}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-37',
  '37 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 37}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-38',
  '38 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 38}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-39',
  '39 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 39}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-40',
  '40 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 40}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-41',
  '41 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 41}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-42',
  '42 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 42}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-43',
  '43 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 43}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-44',
  '44 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 44}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-45',
  '45 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 45}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-46',
  '46 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 46}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-47',
  '47 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 47}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-48',
  '48 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 48}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-49',
  '49 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 49}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-50',
  '50 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 50}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-51',
  '51 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 51}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-52',
  '52 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 52}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-53',
  '53 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 53}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-54',
  '54 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 54}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-55',
  '55 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 55}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-56',
  '56 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 56}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-57',
  '57 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 57}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-58',
  '58 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 58}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-59',
  '59 23 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 59}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-60',
  '0 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 60}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-61',
  '1 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 61}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-62',
  '2 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 62}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-63',
  '3 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 63}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-64',
  '4 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 64}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-65',
  '5 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 65}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-66',
  '6 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 66}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-67',
  '7 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 67}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-68',
  '8 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 68}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-69',
  '9 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 69}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-70',
  '10 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 70}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-71',
  '11 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 71}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-72',
  '12 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 72}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-73',
  '13 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 73}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-74',
  '14 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 74}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-75',
  '15 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 75}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-76',
  '16 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 76}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-77',
  '17 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 77}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-78',
  '18 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 78}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-79',
  '19 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 79}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-80',
  '20 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 80}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-81',
  '21 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 81}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-82',
  '22 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 82}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-83',
  '23 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 83}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-84',
  '24 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 84}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-85',
  '25 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 85}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-86',
  '26 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 86}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-87',
  '27 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 87}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-88',
  '28 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 88}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-89',
  '29 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 89}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-90',
  '30 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 90}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-91',
  '31 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 91}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-92',
  '32 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 92}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-93',
  '33 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 93}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-94',
  '34 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 94}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-95',
  '35 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 95}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-96',
  '36 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 96}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-97',
  '37 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 97}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-98',
  '38 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 98}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-99',
  '39 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 99}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-100',
  '40 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 100}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-101',
  '41 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 101}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-102',
  '42 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 102}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-103',
  '43 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 103}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-104',
  '44 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 104}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-105',
  '45 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 105}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-106',
  '46 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 106}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-107',
  '47 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 107}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-108',
  '48 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 108}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-109',
  '49 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 109}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-110',
  '50 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 110}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-111',
  '51 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 111}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-112',
  '52 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 112}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-113',
  '53 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 113}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-114',
  '54 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 114}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-115',
  '55 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 115}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-116',
  '56 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 116}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-117',
  '57 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 117}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-118',
  '58 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 118}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-119',
  '59 0 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 119}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-120',
  '0 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 120}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-121',
  '1 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 121}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-122',
  '2 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 122}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-123',
  '3 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 123}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-124',
  '4 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 124}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-125',
  '5 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 125}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-126',
  '6 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 126}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-127',
  '7 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 127}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-128',
  '8 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 128}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-129',
  '9 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 129}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-130',
  '10 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 130}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-131',
  '11 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 131}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-132',
  '12 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 132}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-133',
  '13 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 133}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-134',
  '14 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 134}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-135',
  '15 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 135}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-136',
  '16 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 136}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-137',
  '17 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 137}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-138',
  '18 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 138}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-139',
  '19 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 139}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-140',
  '20 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 140}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-141',
  '21 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 141}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-142',
  '22 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 142}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-143',
  '23 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 143}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-144',
  '24 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 144}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-145',
  '25 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 145}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-146',
  '26 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 146}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-147',
  '27 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 147}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-148',
  '28 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 148}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-149',
  '29 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 149}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-150',
  '30 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 150}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-151',
  '31 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 151}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-152',
  '32 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 152}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-153',
  '33 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 153}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-154',
  '34 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 154}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-155',
  '35 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 155}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-156',
  '36 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 156}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-157',
  '37 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 157}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-158',
  '38 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 158}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-159',
  '39 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 159}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-160',
  '40 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 160}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-161',
  '41 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 161}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-162',
  '42 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 162}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-163',
  '43 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 163}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-164',
  '44 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 164}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-165',
  '45 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 165}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-166',
  '46 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 166}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-167',
  '47 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 167}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-168',
  '48 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 168}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-169',
  '49 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 169}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-170',
  '50 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 170}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-171',
  '51 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 171}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-172',
  '52 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 172}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-173',
  '53 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 173}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-174',
  '54 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 174}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-175',
  '55 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 175}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-176',
  '56 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 176}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-177',
  '57 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 177}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-178',
  '58 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 178}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-179',
  '59 1 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 179}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-180',
  '0 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 180}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-181',
  '1 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 181}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-182',
  '2 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 182}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-183',
  '3 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 183}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-184',
  '4 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 184}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-185',
  '5 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 185}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-186',
  '6 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 186}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-187',
  '7 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 187}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-188',
  '8 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 188}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-189',
  '9 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 189}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-190',
  '10 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 190}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-191',
  '11 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 191}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-192',
  '12 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 192}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-193',
  '13 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 193}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-194',
  '14 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 194}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-195',
  '15 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 195}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-196',
  '16 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 196}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-197',
  '17 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 197}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-198',
  '18 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 198}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-199',
  '19 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 199}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-200',
  '20 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 200}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-201',
  '21 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 201}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-202',
  '22 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 202}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-203',
  '23 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 203}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-204',
  '24 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 204}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-205',
  '25 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 205}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-206',
  '26 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 206}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-207',
  '27 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 207}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-208',
  '28 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 208}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-209',
  '29 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 209}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-210',
  '30 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 210}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-211',
  '31 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 211}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-212',
  '32 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 212}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-213',
  '33 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 213}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-214',
  '34 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 214}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-215',
  '35 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 215}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-216',
  '36 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 216}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-217',
  '37 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 217}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-218',
  '38 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 218}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-219',
  '39 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 219}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-220',
  '40 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 220}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-221',
  '41 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 221}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-222',
  '42 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 222}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-223',
  '43 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 223}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-224',
  '44 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 224}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-225',
  '45 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 225}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-226',
  '46 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 226}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-227',
  '47 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 227}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-228',
  '48 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 228}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-229',
  '49 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 229}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-230',
  '50 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 230}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-231',
  '51 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 231}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-232',
  '52 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 232}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-233',
  '53 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 233}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-234',
  '54 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 234}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-235',
  '55 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 235}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-236',
  '56 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 236}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-237',
  '57 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 237}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-238',
  '58 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 238}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-239',
  '59 2 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 239}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-240',
  '0 3 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 240}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-241',
  '1 3 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 241}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-242',
  '2 3 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 242}'::jsonb
  );$$
);
SELECT cron.schedule(
  'iv-rank-batch-243',
  '3 3 * * *',
  $$SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calculate-iv-rank',
    headers := '{"Authorization": "Bearer <YOUR_CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 243}'::jsonb
  );$$
);

SELECT COUNT(*) AS should_be_244 FROM cron.job;
