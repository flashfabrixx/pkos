-- Entity-link suggestions (B8). The background job (server/tasks/
-- suggest-entity-links.ts) recomputes top-N similar entities per entity
-- by cosine distance on entities.embedding. The UI surfaces these as
-- merge candidates inside the entity detail page.

CREATE TABLE IF NOT EXISTS entity_link_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  score REAL NOT NULL CHECK (score >= 0 AND score <= 1),
  reason TEXT NOT NULL DEFAULT 'embedding_cosine',
  dismissed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id, target_id, reason),
  CHECK (source_id <> target_id)
);

CREATE INDEX IF NOT EXISTS entity_link_suggestions_source_idx
  ON entity_link_suggestions (source_id) WHERE accepted_at IS NULL AND dismissed_at IS NULL;
