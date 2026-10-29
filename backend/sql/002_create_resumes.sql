-- Issue #06: Upload Resume
-- A user may store multiple resumes for different interview targets.

CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  s3_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),

  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- A user can own many resumes, so user_id is indexed rather than unique.
CREATE INDEX IF NOT EXISTS idx_resumes_user_id
  ON resumes(user_id);
