ALTER TABLE interview_sessions
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completion_reason TEXT;

UPDATE interview_sessions
SET started_at = COALESCE(started_at, created_at)
WHERE started_at IS NULL;

UPDATE interview_sessions
SET duration_minutes = 30
WHERE duration_minutes IS NULL;

UPDATE interview_sessions
SET ends_at =
  COALESCE(
    ends_at,
    COALESCE(started_at, created_at)
      + (duration_minutes * INTERVAL '1 minute')
  )
WHERE ends_at IS NULL;

ALTER TABLE interview_sessions
ALTER COLUMN started_at SET NOT NULL,
ALTER COLUMN duration_minutes SET NOT NULL,
ALTER COLUMN ends_at SET NOT NULL;

ALTER TABLE interview_sessions
ADD CONSTRAINT interview_sessions_duration_check
CHECK (
  duration_minutes > 0
  AND duration_minutes <= 120
);

ALTER TABLE interview_sessions
ADD CONSTRAINT interview_sessions_completion_reason_check
CHECK (
  completion_reason IS NULL
  OR completion_reason IN (
    'USER_ENDED',
    'TIME_LIMIT',
    'ABANDONED'
  )
);
