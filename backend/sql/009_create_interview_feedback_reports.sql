-- Issue #30: Generate Feedback Report
-- One feedback report per completed interview session.
--   status      GENERATING  a request is building the report right now
--               READY       report holds the validated feedback
--               UNAVAILABLE the transcript didn't have enough to analyze;
--                           unavailable_reason says why (nothing is invented)
--               FAILED      the AI call or its output failed; can be retried
--   report      the validated report JSON (only when READY)
-- Deleting the session deletes its report.

CREATE TABLE IF NOT EXISTS interview_feedback_reports (
  session_id UUID PRIMARY KEY
    REFERENCES interview_sessions(id)
    ON DELETE CASCADE,

  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'GENERATING',
  report JSONB,
  unavailable_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  generated_at TIMESTAMPTZ,

  CONSTRAINT interview_feedback_reports_status_check
    CHECK (status IN ('GENERATING', 'READY', 'UNAVAILABLE', 'FAILED')),

  CONSTRAINT interview_feedback_reports_ready_check
    CHECK (status <> 'READY' OR report IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_interview_feedback_reports_user_id
  ON interview_feedback_reports(user_id);
