-- supabase/migrations/20260530_yahoo_iv_cron.sql
-- Schedule 244 pg_cron jobs for Yahoo IV pass (04:00–08:03 UTC).
-- Runs after calculate-iv-rank finishes (23:00–03:03 UTC), giving ~1hr buffer.
-- Each batch reads current_price from today's iv_snapshots row and updates current_iv.
-- Run this after deploying the fetch-yahoo-iv edge function.

SELECT cron.schedule(
  'yahoo-iv-batch-0',
  '0 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 0}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-1',
  '1 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 1}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-2',
  '2 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 2}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-3',
  '3 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 3}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-4',
  '4 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 4}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-5',
  '5 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 5}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-6',
  '6 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 6}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-7',
  '7 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 7}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-8',
  '8 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 8}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-9',
  '9 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 9}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-10',
  '10 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 10}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-11',
  '11 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 11}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-12',
  '12 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 12}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-13',
  '13 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 13}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-14',
  '14 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 14}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-15',
  '15 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 15}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-16',
  '16 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 16}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-17',
  '17 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 17}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-18',
  '18 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 18}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-19',
  '19 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 19}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-20',
  '20 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 20}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-21',
  '21 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 21}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-22',
  '22 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 22}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-23',
  '23 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 23}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-24',
  '24 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 24}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-25',
  '25 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 25}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-26',
  '26 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 26}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-27',
  '27 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 27}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-28',
  '28 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 28}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-29',
  '29 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 29}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-30',
  '30 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 30}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-31',
  '31 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 31}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-32',
  '32 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 32}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-33',
  '33 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 33}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-34',
  '34 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 34}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-35',
  '35 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 35}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-36',
  '36 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 36}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-37',
  '37 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 37}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-38',
  '38 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 38}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-39',
  '39 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 39}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-40',
  '40 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 40}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-41',
  '41 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 41}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-42',
  '42 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 42}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-43',
  '43 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 43}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-44',
  '44 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 44}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-45',
  '45 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 45}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-46',
  '46 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 46}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-47',
  '47 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 47}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-48',
  '48 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 48}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-49',
  '49 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 49}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-50',
  '50 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 50}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-51',
  '51 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 51}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-52',
  '52 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 52}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-53',
  '53 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 53}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-54',
  '54 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 54}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-55',
  '55 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 55}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-56',
  '56 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 56}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-57',
  '57 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 57}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-58',
  '58 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 58}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-59',
  '59 4 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 59}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-60',
  '0 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 60}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-61',
  '1 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 61}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-62',
  '2 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 62}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-63',
  '3 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 63}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-64',
  '4 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 64}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-65',
  '5 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 65}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-66',
  '6 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 66}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-67',
  '7 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 67}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-68',
  '8 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 68}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-69',
  '9 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 69}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-70',
  '10 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 70}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-71',
  '11 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 71}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-72',
  '12 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 72}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-73',
  '13 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 73}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-74',
  '14 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 74}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-75',
  '15 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 75}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-76',
  '16 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 76}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-77',
  '17 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 77}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-78',
  '18 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 78}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-79',
  '19 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 79}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-80',
  '20 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 80}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-81',
  '21 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 81}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-82',
  '22 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 82}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-83',
  '23 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 83}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-84',
  '24 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 84}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-85',
  '25 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 85}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-86',
  '26 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 86}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-87',
  '27 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 87}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-88',
  '28 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 88}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-89',
  '29 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 89}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-90',
  '30 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 90}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-91',
  '31 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 91}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-92',
  '32 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 92}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-93',
  '33 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 93}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-94',
  '34 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 94}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-95',
  '35 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 95}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-96',
  '36 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 96}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-97',
  '37 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 97}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-98',
  '38 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 98}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-99',
  '39 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 99}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-100',
  '40 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 100}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-101',
  '41 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 101}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-102',
  '42 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 102}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-103',
  '43 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 103}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-104',
  '44 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 104}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-105',
  '45 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 105}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-106',
  '46 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 106}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-107',
  '47 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 107}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-108',
  '48 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 108}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-109',
  '49 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 109}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-110',
  '50 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 110}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-111',
  '51 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 111}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-112',
  '52 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 112}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-113',
  '53 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 113}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-114',
  '54 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 114}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-115',
  '55 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 115}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-116',
  '56 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 116}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-117',
  '57 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 117}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-118',
  '58 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 118}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-119',
  '59 5 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 119}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-120',
  '0 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 120}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-121',
  '1 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 121}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-122',
  '2 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 122}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-123',
  '3 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 123}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-124',
  '4 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 124}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-125',
  '5 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 125}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-126',
  '6 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 126}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-127',
  '7 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 127}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-128',
  '8 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 128}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-129',
  '9 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 129}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-130',
  '10 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 130}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-131',
  '11 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 131}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-132',
  '12 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 132}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-133',
  '13 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 133}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-134',
  '14 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 134}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-135',
  '15 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 135}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-136',
  '16 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 136}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-137',
  '17 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 137}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-138',
  '18 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 138}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-139',
  '19 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 139}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-140',
  '20 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 140}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-141',
  '21 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 141}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-142',
  '22 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 142}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-143',
  '23 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 143}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-144',
  '24 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 144}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-145',
  '25 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 145}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-146',
  '26 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 146}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-147',
  '27 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 147}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-148',
  '28 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 148}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-149',
  '29 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 149}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-150',
  '30 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 150}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-151',
  '31 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 151}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-152',
  '32 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 152}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-153',
  '33 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 153}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-154',
  '34 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 154}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-155',
  '35 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 155}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-156',
  '36 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 156}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-157',
  '37 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 157}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-158',
  '38 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 158}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-159',
  '39 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 159}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-160',
  '40 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 160}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-161',
  '41 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 161}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-162',
  '42 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 162}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-163',
  '43 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 163}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-164',
  '44 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 164}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-165',
  '45 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 165}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-166',
  '46 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 166}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-167',
  '47 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 167}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-168',
  '48 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 168}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-169',
  '49 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 169}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-170',
  '50 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 170}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-171',
  '51 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 171}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-172',
  '52 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 172}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-173',
  '53 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 173}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-174',
  '54 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 174}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-175',
  '55 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 175}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-176',
  '56 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 176}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-177',
  '57 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 177}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-178',
  '58 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 178}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-179',
  '59 6 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 179}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-180',
  '0 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 180}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-181',
  '1 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 181}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-182',
  '2 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 182}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-183',
  '3 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 183}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-184',
  '4 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 184}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-185',
  '5 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 185}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-186',
  '6 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 186}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-187',
  '7 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 187}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-188',
  '8 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 188}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-189',
  '9 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 189}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-190',
  '10 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 190}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-191',
  '11 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 191}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-192',
  '12 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 192}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-193',
  '13 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 193}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-194',
  '14 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 194}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-195',
  '15 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 195}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-196',
  '16 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 196}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-197',
  '17 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 197}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-198',
  '18 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 198}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-199',
  '19 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 199}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-200',
  '20 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 200}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-201',
  '21 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 201}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-202',
  '22 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 202}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-203',
  '23 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 203}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-204',
  '24 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 204}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-205',
  '25 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 205}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-206',
  '26 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 206}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-207',
  '27 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 207}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-208',
  '28 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 208}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-209',
  '29 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 209}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-210',
  '30 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 210}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-211',
  '31 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 211}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-212',
  '32 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 212}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-213',
  '33 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 213}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-214',
  '34 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 214}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-215',
  '35 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 215}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-216',
  '36 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 216}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-217',
  '37 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 217}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-218',
  '38 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 218}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-219',
  '39 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 219}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-220',
  '40 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 220}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-221',
  '41 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 221}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-222',
  '42 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 222}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-223',
  '43 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 223}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-224',
  '44 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 224}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-225',
  '45 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 225}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-226',
  '46 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 226}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-227',
  '47 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 227}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-228',
  '48 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 228}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-229',
  '49 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 229}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-230',
  '50 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 230}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-231',
  '51 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 231}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-232',
  '52 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 232}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-233',
  '53 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 233}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-234',
  '54 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 234}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-235',
  '55 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 235}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-236',
  '56 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 236}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-237',
  '57 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 237}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-238',
  '58 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 238}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-239',
  '59 7 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 239}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-240',
  '0 8 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 240}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-241',
  '1 8 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 241}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-242',
  '2 8 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 242}'::jsonb
  );$$
);
SELECT cron.schedule(
  'yahoo-iv-batch-243',
  '3 8 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-yahoo-iv',
    headers := '{"Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525", "Content-Type": "application/json"}'::jsonb,
    body := '{"batchIndex": 243}'::jsonb
  );$$
);

SELECT COUNT(*) AS should_be_488 FROM cron.job;
