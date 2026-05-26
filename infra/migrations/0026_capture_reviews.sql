-- pg_trgm powers the fuzzy entity-match check that produces
-- entity_match review rows. Cheap, deterministic, no LLM call.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Capture Review Step (Sprint A).
--
-- The extractor processes captures silently most of the time. When it
-- is genuinely unsure about a piece of structured output (e.g. an
-- extracted person name that fuzzy-matches an existing entity but the
-- score sits in the grey zone), it parks a review prompt here instead
-- of guessing. The user resolves the prompt inline from the capture
-- detail page; the resolution patches the extracted data and flips
-- the row's status.
--
-- `kind` is open-ended on purpose - Sprint A wires up entity_match;
-- later sprints add tag_propose / action_assignee / date_ambiguous
-- against the same table without further migrations.

CREATE TABLE IF NOT EXISTS capture_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('entity_match', 'tag_propose', 'action_assignee', 'date_ambiguous', 'project_create')),
  -- What the extractor saw (raw text, surrounding context, confidence).
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- What the extractor would suggest doing (e.g. link to entity X, or
  -- create a new tag). The wizard renders this; resolution applies it.
  suggestion JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  -- Resolution details: which action the user picked + when.
  resolution JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Sidebar badge query: count open reviews. Hot path on every page
-- load, so keep it index-fast.
CREATE INDEX IF NOT EXISTS capture_reviews_status_idx
  ON capture_reviews (status, created_at DESC)
  WHERE status = 'open';

-- Inline wizard query: reviews for a specific document.
CREATE INDEX IF NOT EXISTS capture_reviews_document_idx
  ON capture_reviews (document_id, status, created_at);
