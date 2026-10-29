-- Upload Resume (Issue #06).
-- Run once against the application database before deploying the backend
-- routes GET/PUT/DELETE /me/resume and GET /me/resume/file.
--
-- One resume per user. The file itself lives in the private S3 bucket named
-- by RESUME_BUCKET; this table stores the S3 key and file details.
-- user_id must match the type of users.id (change UUID to TEXT below if
-- users.id is a TEXT column).

CREATE TABLE IF NOT EXISTS resumes (
  user_id      UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  s3_key       TEXT          NOT NULL,
  file_name    VARCHAR(255)  NOT NULL,
  content_type VARCHAR(120)  NOT NULL,
  size_bytes   INTEGER       NOT NULL CHECK (size_bytes > 0),
  uploaded_at  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
