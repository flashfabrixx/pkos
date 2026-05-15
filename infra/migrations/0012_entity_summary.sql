ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS summary_state TEXT NOT NULL DEFAULT 'absent'
    CHECK (summary_state IN ('absent', 'fresh', 'stale', 'generating', 'failed')),
  ADD COLUMN IF NOT EXISTS summary_updated_at TIMESTAMPTZ;
