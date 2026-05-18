-- Add paper_mode column to user_preferences
-- Required by PaperModeContext which reads/writes this column,
-- and by AuthContext which initialises it to false on user creation.
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS paper_mode BOOLEAN DEFAULT false;
