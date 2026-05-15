-- Per-document language tag (ISO 639-1: 'en', 'de', 'fr', ...). NULL means
-- "unknown / not detected" — search falls back to the generic `simple` config.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS language TEXT;

-- The original schema generated chunks.search_vector with a hard-coded
-- `simple` config. Drop the generated form so we can populate it with a
-- language-specific config from the application layer.
DROP INDEX IF EXISTS chunks_search_vector_idx;

ALTER TABLE chunks
  DROP COLUMN IF EXISTS search_vector;

ALTER TABLE chunks
  ADD COLUMN search_vector tsvector;

-- Backfill existing rows with the generic config so search keeps working
-- until they get re-indexed with their detected language.
UPDATE chunks SET search_vector = to_tsvector('simple', content) WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS chunks_search_vector_idx
  ON chunks USING GIN (search_vector);
