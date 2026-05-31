-- supabase/migrations/20260530_yahoo_iv_cron.sql
-- Schedule 49 pg_cron jobs for Yahoo IV pass (04:00–04:48 UTC), 10 tickers each.
-- Runs after calculate-iv-rank finishes (23:00–03:03 UTC), giving ~1hr buffer.
-- Each batch reads current_price from today's iv_snapshots row and updates current_iv.
-- Heartbeat runs at 09:00 UTC, well after Yahoo completes.
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

-- Heartbeat at 09:00 UTC (after Yahoo IV completes at 04:48 UTC)
SELECT cron.schedule(
  'heartbeat-monitor-daily',
  '0 9 * * *',
  $$SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/heartbeat-monitor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer 4e599f7a90441160c23e7e6f85e6a70f78b063941f335a25869c848b11430525"}'::jsonb,
    body := '{}' ::jsonb
  ) AS request_id;$$
);

SELECT COUNT(*) AS should_be_49 FROM cron.job WHERE jobname LIKE 'yahoo-iv-batch-%';
