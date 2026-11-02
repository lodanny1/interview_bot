-- Issue #07: Extract Resume Information
-- Stores resume extraction state and results on the resume itself.

ALTER TABLE resumes
ADD COLUMN IF NOT EXISTS parse_status TEXT
  NOT NULL
  DEFAULT 'PENDING';

ALTER TABLE resumes
ADD COLUMN IF NOT EXISTS parsed_text TEXT;

ALTER TABLE resumes
ADD COLUMN IF NOT EXISTS parsed_json JSONB;

ALTER TABLE resumes
ADD COLUMN IF NOT EXISTS parsed_at TIMESTAMPTZ;

ALTER TABLE resumes
ADD COLUMN IF NOT EXISTS parse_error TEXT;

ALTER TABLE resumes
ADD CONSTRAINT resumes_parse_status_check
CHECK (
  parse_status IN (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED'
  )
);