-- ============================================================
-- WheelHouse — Initial Schema
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

-- ── Watchlist items ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlist_items (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ticker     TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, ticker)
);

-- ── Wheel positions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wheel_positions (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ticker            TEXT NOT NULL,
  strategy          TEXT CHECK (strategy IN ('CSP', 'CC')) NOT NULL,
  strike            DECIMAL(10,2) NOT NULL,
  expiry            DATE NOT NULL,
  premium_collected DECIMAL(10,2) NOT NULL,
  contracts         INTEGER DEFAULT 1 NOT NULL,
  status            TEXT CHECK (status IN ('open', 'closed', 'assigned')) DEFAULT 'open',
  notes             TEXT,
  opened_at         TIMESTAMPTZ DEFAULT NOW(),
  closed_at         TIMESTAMPTZ,
  closing_price     DECIMAL(10,2),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── IV snapshots cache ────────────────────────────────────────
-- Shared across all users — avoids redundant Polygon API calls
CREATE TABLE IF NOT EXISTS iv_snapshots (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker        TEXT NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  iv_rank       DECIMAL(5,2),
  iv_percentile DECIMAL(5,2),
  current_hv    DECIMAL(8,4),
  hv_30         DECIMAL(8,4),
  hv_52wk_high  DECIMAL(8,4),
  hv_52wk_low   DECIMAL(8,4),
  iv_hv_ratio   DECIMAL(6,4),
  weekly_history JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, snapshot_date)
);

-- ── User preferences ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  theme        TEXT DEFAULT 'dark',
  default_sort TEXT DEFAULT 'iv_rank',
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE watchlist_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE wheel_positions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences  ENABLE ROW LEVEL SECURITY;
ALTER TABLE iv_snapshots      ENABLE ROW LEVEL SECURITY;

-- Watchlist: users own their rows
CREATE POLICY "Users can manage own watchlist"
  ON watchlist_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Positions: users own their rows
CREATE POLICY "Users can manage own positions"
  ON wheel_positions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Preferences: users own their row
CREATE POLICY "Users can manage own preferences"
  ON user_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- IV snapshots: anyone can read, authenticated users can write
CREATE POLICY "Anyone can read IV snapshots"
  ON iv_snapshots FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert IV snapshots"
  ON iv_snapshots FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update IV snapshots"
  ON iv_snapshots FOR UPDATE
  USING (true)
  WITH CHECK (auth.role() = 'authenticated');
