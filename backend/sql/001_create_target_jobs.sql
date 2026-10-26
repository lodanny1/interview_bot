-- Add Target Job Description (Issue #09).
-- Run once against the application database before deploying the backend
-- routes GET/PUT/DELETE /me/target-job.
--
-- One target job per user for now. user_id must match the type of users.id
-- (users.id is set with crypto.randomUUID(); change UUID to TEXT below if
-- users.id is a TEXT column).

CREATE TABLE IF NOT EXISTS target_jobs (
  user_id     UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  job_title   VARCHAR(120)  NOT NULL,
  company     VARCHAR(120),
  description TEXT          NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
