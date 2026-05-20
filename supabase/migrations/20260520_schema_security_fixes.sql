-- Batch schema security fixes.

-- 1. iv_snapshots UPDATE policy is too permissive (USING true = any authenticated user can update any row).
--    Drop the user UPDATE policy; cache writes go through service role only.
DROP POLICY IF EXISTS "Authenticated users can update iv snapshots" ON iv_snapshots;

-- 2. Fix FK constraints with RESTRICT default that block deleting admin users.
--    user_profiles.banned_by and subscriptions.manually_set_by must be ON DELETE SET NULL.
ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_banned_by_fkey,
  ADD CONSTRAINT user_profiles_banned_by_fkey
    FOREIGN KEY (banned_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_manually_set_by_fkey,
  ADD CONSTRAINT subscriptions_manually_set_by_fkey
    FOREIGN KEY (manually_set_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. checklist_analytics INSERT policy allows anon writes (storage exhaustion vector).
--    Restrict to authenticated users only.
DROP POLICY IF EXISTS "Allow insert for analytics" ON checklist_analytics;
CREATE POLICY "Allow insert for analytics"
  ON checklist_analytics FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 4. admin_users_overview view runs as owner (security_invoker=false) with no RLS,
--    so any query with anon key would expose all user data.
--    Recreate the view with a superuser check built in.
CREATE OR REPLACE VIEW admin_users_overview
  WITH (security_invoker = false)
AS
SELECT
  u.id                                    AS user_id,
  u.email,
  u.raw_user_meta_data->>'display_name'   AS display_name,
  u.raw_user_meta_data->>'country'        AS country,
  p.last_seen_at,
  0                                       AS total_sessions,
  (
    SELECT COUNT(*)::int
    FROM wheel_positions wp
    WHERE wp.user_id = u.id AND wp.status = 'open'
  )                                       AS positions_count,
  COALESCE(p.is_banned, false)            AS is_banned,
  p.notes,
  COALESCE(s.tier, 'free')               AS tier,
  COALESCE(s.status, 'free')             AS status,
  s.current_period_end,
  s.trial_end,
  s.stripe_customer_id,
  s.stripe_subscription_id,
  u.created_at                            AS signup_date,
  s.manually_set_by,
  s.manually_set_reason,
  up.disclaimer_version,
  up.disclaimer_accepted_at
FROM auth.users u
LEFT JOIN user_profiles p         ON p.user_id = u.id
LEFT JOIN subscriptions s         ON s.user_id = u.id
LEFT JOIN user_preferences up     ON up.user_id = u.id
-- Only superusers can see this view; non-superusers get zero rows.
WHERE EXISTS (
  SELECT 1 FROM subscriptions sq
  WHERE sq.user_id = auth.uid() AND sq.tier = 'superuser'
);

-- 5. Missing indexes on user_id columns used in RLS policies.
CREATE INDEX IF NOT EXISTS wheel_positions_user_id_idx      ON wheel_positions      (user_id);
CREATE INDEX IF NOT EXISTS watchlist_items_user_id_idx      ON watchlist_items      (user_id);
CREATE INDEX IF NOT EXISTS portfolio_holdings_user_id_idx   ON portfolio_holdings   (user_id);
CREATE INDEX IF NOT EXISTS portfolio_snapshots_user_id_idx  ON portfolio_snapshots  (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_sub_id_idx  ON subscriptions        (stripe_subscription_id);

-- 6. wheel_positions.status should be NOT NULL (NULL values escape all status-based filters).
UPDATE wheel_positions SET status = 'open' WHERE status IS NULL;
ALTER TABLE wheel_positions ALTER COLUMN status SET NOT NULL;

-- 7. portfolio_holdings.status should also be NOT NULL.
UPDATE portfolio_holdings SET status = 'open' WHERE status IS NULL;
ALTER TABLE portfolio_holdings ALTER COLUMN status SET NOT NULL;
