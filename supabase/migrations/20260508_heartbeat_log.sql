-- Heartbeat monitor log: one row per automated or manual health check
CREATE TABLE IF NOT EXISTS heartbeat_log (
  id               BIGSERIAL    PRIMARY KEY,
  checked_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  status           TEXT         NOT NULL CHECK (status IN ('ok', 'warning', 'critical')),
  snapshot_date    DATE,
  tickers_covered  INTEGER,
  tickers_expected INTEGER      NOT NULL DEFAULT 488,
  coverage_pct     NUMERIC(5,2),
  total_runs       INTEGER,
  failed_runs      INTEGER,
  last_run_at      TIMESTAMPTZ,
  alert_sent       BOOLEAN      NOT NULL DEFAULT FALSE,
  triggered_by     TEXT         NOT NULL DEFAULT 'cron',
  message          TEXT,
  details          JSONB
);

CREATE INDEX heartbeat_log_checked_at_idx ON heartbeat_log (checked_at DESC);

ALTER TABLE heartbeat_log ENABLE ROW LEVEL SECURITY;

-- Superusers can read; the edge function writes via the service role (bypasses RLS)
CREATE POLICY "superuser_read_heartbeat_log"
  ON heartbeat_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM subscriptions
      WHERE user_id = auth.uid() AND tier = 'superuser'
    )
  );
