-- Fix: admin_audit_log FK constraints block deleting users who have audit entries.
-- Any user who was banned has at least one audit row, making them undeletable.
-- ON DELETE SET NULL preserves the historical record while allowing user deletion.

ALTER TABLE admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_target_user_id_fkey,
  ADD CONSTRAINT admin_audit_log_target_user_id_fkey
    FOREIGN KEY (target_user_id)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;

ALTER TABLE admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_admin_user_id_fkey,
  ADD CONSTRAINT admin_audit_log_admin_user_id_fkey
    FOREIGN KEY (admin_user_id)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;
