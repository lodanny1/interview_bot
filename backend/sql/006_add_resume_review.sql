-- Issue #08: Review Resume Information
-- Stores the user's reviewed resume information next to the original AI
-- extraction in parsed_json, which is left unchanged.

ALTER TABLE resumes
ADD COLUMN IF NOT EXISTS reviewed_json JSONB;

ALTER TABLE resumes
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
