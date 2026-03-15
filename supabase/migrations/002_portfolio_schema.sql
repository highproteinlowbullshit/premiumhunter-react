-- PremiumHunter — Portfolio Schema
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor)

CREATE TABLE portfolio_holdings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ticker TEXT NOT NULL,
  holding_type TEXT CHECK (holding_type IN ('shares', 'leaps_call', 'leaps_put', 'other')) NOT NULL,
  quantity DECIMAL(12,4) NOT NULL,
  avg_cost DECIMAL(10,4) NOT NULL,
  closing_price DECIMAL(10,4),
  expiry DATE,
  strike DECIMAL(10,2),
  notes TEXT,
  opened_at DATE NOT NULL DEFAULT CURRENT_DATE,
  closed_at DATE,
  status TEXT CHECK (status IN ('open', 'closed')) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE portfolio_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_value DECIMAL(14,2) NOT NULL,
  total_cost DECIMAL(14,2) NOT NULL,
  unrealized_pnl DECIMAL(14,2) NOT NULL,
  realized_pnl DECIMAL(14,2) NOT NULL,
  options_premium DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date)
);

ALTER TABLE portfolio_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own holdings"
  ON portfolio_holdings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own snapshots"
  ON portfolio_snapshots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
