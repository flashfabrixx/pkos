-- First-run setup tracking (B9). Singleton row; `completed_at` flips on
-- when the operator has finished the /setup wizard. Until then the
-- onboarding middleware redirects non-API browsers to /setup.

CREATE TABLE IF NOT EXISTS setup_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  completed_at TIMESTAMPTZ,
  notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT setup_state_singleton CHECK (id = 1)
);

INSERT INTO setup_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
