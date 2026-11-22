-- Word-level timing for spoken answers (Issue #23 transcription, used by #27/#28/#33).
-- Array of { "text": string, "start": seconds, "end": seconds }.
-- NULL for text answers, interviewer messages, and answers saved before this column existed.
--

ALTER TABLE interview_messages
  ADD COLUMN IF NOT EXISTS words jsonb;
