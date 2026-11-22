CREATE TABLE IF NOT EXISTS interview_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  session_id UUID NOT NULL
    REFERENCES interview_sessions(id)
    ON DELETE CASCADE,

  question_message_id UUID NOT NULL
    REFERENCES interview_messages(id)
    ON DELETE CASCADE,

  s3_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interview_recordings_session_question
  ON interview_recordings(session_id, question_message_id);