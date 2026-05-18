-- ============================================================
-- Missing tables required by the user creation flow and app.
-- Tables are referenced throughout the codebase but were never
-- created in any migration.
-- ============================================================

-- ── User profiles ─────────────────────────────────────────────
-- Written by useLastSeen (upsert on every protected page load)
-- and by admin functions (ban, add-note) via service role.
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  last_seen_at TIMESTAMPTZ,
  is_banned    BOOLEAN     NOT NULL DEFAULT false,
  ban_reason   TEXT,
  banned_at    TIMESTAMPTZ,
  banned_by    UUID        REFERENCES auth.users(id),
  notes        TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can upsert their own last_seen_at / updated_at
CREATE POLICY "Users can upsert own profile"
  ON user_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Disclaimer acceptance ──────────────────────────────────────
-- Written by useDisclaimer when user accepts the disclaimer modal.
CREATE TABLE IF NOT EXISTS disclaimer_acceptance (
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  disclaimer_version   TEXT        NOT NULL,
  accepted_at          TIMESTAMPTZ NOT NULL,
  user_agent           TEXT,
  typed_confirmation   TEXT
);

ALTER TABLE disclaimer_acceptance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own disclaimer acceptance"
  ON disclaimer_acceptance FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Subscriptions ──────────────────────────────────────────────
-- Read by useSubscription; written by Stripe webhook and admin
-- edge functions (both use service role, bypass RLS).
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id                UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  tier                   TEXT        NOT NULL DEFAULT 'free'
                           CHECK (tier IN ('free', 'pro', 'premium', 'superuser')),
  status                 TEXT        NOT NULL DEFAULT 'free',
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id        TEXT,
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  trial_end              TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN     NOT NULL DEFAULT false,
  canceled_at            TIMESTAMPTZ,
  manually_set_by        UUID        REFERENCES auth.users(id),
  manually_set_at        TIMESTAMPTZ,
  manually_set_reason    TEXT,
  access_until           TIMESTAMPTZ,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription row (tier gating on the client)
CREATE POLICY "Users can read own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- ── Admin audit log ────────────────────────────────────────────
-- Append-only; all writes happen via service role from admin edge functions.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id  UUID        REFERENCES auth.users(id),
  action         TEXT        NOT NULL,
  target_user_id UUID        REFERENCES auth.users(id),
  old_value      JSONB,
  new_value      JSONB,
  reason         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_user_idx ON admin_audit_log (target_user_id);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Superusers can read the audit log; writes go through service role
CREATE POLICY "Superusers can read audit log"
  ON admin_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM subscriptions
      WHERE user_id = auth.uid() AND tier = 'superuser'
    )
  );

-- ── Admin users overview (view) ────────────────────────────────
-- Queried by admin-get-users edge function via service role.
-- Joins auth.users with the tables above to produce the AdminUser shape.
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
  u.created_at                            AS signup_date,
  s.manually_set_by,
  s.manually_set_reason,
  d.disclaimer_version,
  d.accepted_at                           AS disclaimer_accepted_at
FROM auth.users u
LEFT JOIN user_profiles        p ON p.user_id = u.id
LEFT JOIN subscriptions        s ON s.user_id = u.id
LEFT JOIN disclaimer_acceptance d ON d.user_id = u.id;
