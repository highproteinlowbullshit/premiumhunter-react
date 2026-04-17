-- supabase/migrations/20260417_earnings_date_cache.sql
-- Add earnings_date to iv_snapshots so the nightly cron can cache the next
-- confirmed/estimated earnings date alongside IV and price data.
-- Frontend reads this instead of making a live Finnhub call per trade checklist open.

ALTER TABLE iv_snapshots
  ADD COLUMN IF NOT EXISTS earnings_date DATE;
