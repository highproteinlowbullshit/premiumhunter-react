-- supabase/migrations/20260411_price_volume_cache.sql
-- Add price change and volume columns to iv_snapshots so the nightly cron
-- can cache all screener data in one place, eliminating Finnhub calls.

ALTER TABLE iv_snapshots
  ADD COLUMN IF NOT EXISTS prev_close        DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS price_change_pct  DECIMAL(8,4),
  ADD COLUMN IF NOT EXISTS volume            BIGINT;
