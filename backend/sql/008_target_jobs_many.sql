ALTER TABLE target_jobs
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

UPDATE target_jobs
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE target_jobs
ALTER COLUMN id SET NOT NULL;

ALTER TABLE target_jobs
DROP CONSTRAINT IF EXISTS target_jobs_pkey;

ALTER TABLE target_jobs
ADD CONSTRAINT target_jobs_pkey PRIMARY KEY (id);

CREATE INDEX IF NOT EXISTS idx_target_jobs_user_id
ON target_jobs(user_id);
