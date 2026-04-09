-- supabase/migrations/20260408_iv_rank_cron.sql

-- ── Monitoring columns on iv_snapshots ────────────────────────────────────────
-- These are optional metadata columns. The Edge Function writes them;
-- the frontend ignores them. Safe to add with IF NOT EXISTS.
ALTER TABLE iv_snapshots
  ADD COLUMN IF NOT EXISTS current_price       DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS data_source         TEXT DEFAULT 'frontend_live',
  ADD COLUMN IF NOT EXISTS calculation_success BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS error_message       TEXT;

-- ── cron_run_logs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cron_run_logs (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name    TEXT NOT NULL,
  started_at       TIMESTAMPTZ NOT NULL,
  completed_at     TIMESTAMPTZ,
  duration_seconds DECIMAL(8,2),
  stocks_processed INTEGER DEFAULT 0,
  stocks_succeeded INTEGER DEFAULT 0,
  stocks_failed    INTEGER DEFAULT 0,
  errors           TEXT[],
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_logs_function_started
  ON cron_run_logs (function_name, started_at DESC);

-- RLS: authenticated users can SELECT (for the freshness indicator in the UI)
-- Service role (used by the Edge Function) bypasses RLS automatically.
ALTER TABLE cron_run_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cron logs"
  ON cron_run_logs FOR SELECT
  USING (auth.role() = 'authenticated');
