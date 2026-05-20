-- Trigger to prevent regular users from modifying ban-related columns on user_profiles.
-- Service role calls have auth.uid() = NULL (no JWT context); user calls have auth.uid() set.
-- This means only service-role clients (edge functions) can write ban columns.

CREATE OR REPLACE FUNCTION protect_ban_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- auth.uid() is NULL for service role requests; non-NULL for user JWT requests.
  -- Only enforce restrictions when a real user is making the request.
  IF auth.uid() IS NOT NULL THEN
    IF OLD.is_banned   IS DISTINCT FROM NEW.is_banned   THEN
      RAISE EXCEPTION 'Permission denied: is_banned can only be set by admins';
    END IF;
    IF OLD.ban_reason  IS DISTINCT FROM NEW.ban_reason  THEN
      RAISE EXCEPTION 'Permission denied: ban_reason can only be set by admins';
    END IF;
    IF OLD.banned_at   IS DISTINCT FROM NEW.banned_at   THEN
      RAISE EXCEPTION 'Permission denied: banned_at can only be set by admins';
    END IF;
    IF OLD.banned_by   IS DISTINCT FROM NEW.banned_by   THEN
      RAISE EXCEPTION 'Permission denied: banned_by can only be set by admins';
    END IF;
    IF OLD.notes       IS DISTINCT FROM NEW.notes       THEN
      RAISE EXCEPTION 'Permission denied: notes can only be set by admins';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_ban_column_protection ON user_profiles;
CREATE TRIGGER enforce_ban_column_protection
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_ban_columns();
