-- Phase 1: real IV column alongside HV in iv_snapshots
ALTER TABLE iv_snapshots
  ADD COLUMN IF NOT EXISTS current_iv numeric;

-- Phase 2: per-contract option price snapshots (global market data, not per-user)
CREATE TABLE IF NOT EXISTS option_price_snapshots (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker          text        NOT NULL,
  strike          numeric     NOT NULL,
  expiry          date        NOT NULL,
  contract_type   text        NOT NULL CHECK (contract_type IN ('call', 'put')),
  snapshot_date   date        NOT NULL,
  snapshot_time   timestamptz NOT NULL DEFAULT now(),
  bid             numeric,
  ask             numeric,
  mid             numeric,
  last_price      numeric,
  implied_volatility numeric,
  volume          integer,
  open_interest   integer,
  UNIQUE (ticker, strike, expiry, contract_type, snapshot_date)
);

ALTER TABLE option_price_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_option_prices"
  ON option_price_snapshots FOR SELECT
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_option_prices_lookup
  ON option_price_snapshots (ticker, expiry, snapshot_date DESC);
