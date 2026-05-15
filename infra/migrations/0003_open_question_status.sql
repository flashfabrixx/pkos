ALTER TABLE open_questions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'dismissed'));

ALTER TABLE open_questions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS open_questions_status_idx ON open_questions (status);
