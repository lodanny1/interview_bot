-- Issue #16: Role & Company Knowledge Retrieval
-- Stores what an interview was started with, so every question in the session
-- uses the same notes even if the target job or the knowledge base changes:
--   prompt_input       role, company, interview type and the retrieved
--                      knowledge (backend/src/interview/interview-knowledge.js)
--   knowledge_summary  ids, versions and statuses of the notes used, for review
-- Sessions started before this migration have NULL in both and keep working.

ALTER TABLE interview_sessions
ADD COLUMN IF NOT EXISTS prompt_input JSONB;

ALTER TABLE interview_sessions
ADD COLUMN IF NOT EXISTS knowledge_summary JSONB;
