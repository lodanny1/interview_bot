ALTER TABLE interview_sessions
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS remaining_seconds INTEGER;

ALTER TABLE interview_sessions
  DROP CONSTRAINT IF EXISTS interview_sessions_status_check;

ALTER TABLE interview_sessions
  ADD CONSTRAINT interview_sessions_status_check
  CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED'));

ALTER TABLE interview_sessions
  DROP CONSTRAINT IF EXISTS interview_sessions_remaining_seconds_check;

ALTER TABLE interview_sessions
  ADD CONSTRAINT interview_sessions_remaining_seconds_check
  CHECK (remaining_seconds IS NULL OR remaining_seconds >= 0);