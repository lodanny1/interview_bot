CREATE TABLE IF NOT EXISTS interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  resume_id UUID
    REFERENCES resumes(id)
    ON DELETE SET NULL,

  goal TEXT NOT NULL,
  title TEXT NOT NULL,
  focus_area TEXT NOT NULL,
  mode TEXT NOT NULL,

  industry TEXT,
  role_level TEXT,
  experience_level TEXT,
  job_description TEXT,

  status TEXT NOT NULL DEFAULT 'ACTIVE',

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,

  CONSTRAINT interview_sessions_goal_check
    CHECK (goal IN ('general', 'specific')),

  CONSTRAINT interview_sessions_mode_check
    CHECK (mode IN ('text', 'voice', 'avatar')),

  CONSTRAINT interview_sessions_status_check
    CHECK (status IN ('ACTIVE', 'COMPLETED', 'ABANDONED'))
);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id
  ON interview_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_resume_id
  ON interview_sessions(resume_id);


CREATE TABLE IF NOT EXISTS interview_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  session_id UUID NOT NULL
    REFERENCES interview_sessions(id)
    ON DELETE CASCADE,

  role TEXT NOT NULL,
  content TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT interview_messages_role_check
    CHECK (role IN ('interviewer', 'candidate'))
);

CREATE INDEX IF NOT EXISTS idx_interview_messages_session_id
  ON interview_messages(session_id);

CREATE INDEX IF NOT EXISTS idx_interview_messages_session_created
  ON interview_messages(session_id, created_at, id);
