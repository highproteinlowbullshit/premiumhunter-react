-- Paper trading tables: paper_accounts, paper_positions, paper_snapshots.
-- These tables were used in production code but had no migration.

CREATE TABLE IF NOT EXISTS paper_accounts (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starting_balance        NUMERIC     NOT NULL DEFAULT 100000,
  current_cash            NUMERIC     NOT NULL DEFAULT 100000,
  total_premium_collected NUMERIC     NOT NULL DEFAULT 0,
  total_realized_pnl      NUMERIC     NOT NULL DEFAULT 0,
  trades_won              INTEGER     NOT NULL DEFAULT 0,
  trades_total            INTEGER     NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reset_at                TIMESTAMPTZ,
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS paper_positions (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker                    TEXT        NOT NULL,
  strategy                  TEXT        NOT NULL CHECK (strategy IN ('CSP', 'CC')),
  strike                    NUMERIC     NOT NULL,
  expiry                    DATE        NOT NULL,
  premium_collected         NUMERIC     NOT NULL,
  contracts                 INTEGER     NOT NULL DEFAULT 1,
  underlying_price_at_entry NUMERIC     NOT NULL DEFAULT 0,
  status                    TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'expired', 'assigned')),
  notes                     TEXT,
  opened_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at                 TIMESTAMPTZ,
  closing_premium           NUMERIC,
  realized_pnl              NUMERIC,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paper_snapshots (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date  DATE        NOT NULL,
  portfolio_value NUMERIC    NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, snapshot_date)
);

-- Indexes for RLS performance
CREATE INDEX IF NOT EXISTS paper_accounts_user_id_idx  ON paper_accounts  (user_id);
CREATE INDEX IF NOT EXISTS paper_positions_user_id_idx ON paper_positions (user_id);
CREATE INDEX IF NOT EXISTS paper_snapshots_user_id_idx ON paper_snapshots (user_id);

-- Row Level Security
ALTER TABLE paper_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own paper account"
  ON paper_accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own paper positions"
  ON paper_positions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own paper snapshots"
  ON paper_snapshots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
