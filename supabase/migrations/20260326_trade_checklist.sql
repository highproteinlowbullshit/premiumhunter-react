-- Add risk preference columns to user_preferences
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS max_risk_percent DECIMAL(5,2) DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS account_balance  DECIMAL(14,2) DEFAULT 0;

-- Store checklist snapshot on each wheel position
ALTER TABLE wheel_positions
  ADD COLUMN IF NOT EXISTS checklist_snapshot JSONB;

-- Anonymous checklist analytics (no user_id)
CREATE TABLE IF NOT EXISTS checklist_analytics (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker        text NOT NULL,
  strategy      text NOT NULL,
  checks_passed int  NOT NULL DEFAULT 0,
  checks_warned int  NOT NULL DEFAULT 0,
  checks_failed int  NOT NULL DEFAULT 0,
  checks_overridden int NOT NULL DEFAULT 0,
  submitted_anyway  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Append-only access: anyone can insert, no client can read/update/delete
ALTER TABLE checklist_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert analytics"
  ON checklist_analytics
  FOR INSERT
  WITH CHECK (true);
