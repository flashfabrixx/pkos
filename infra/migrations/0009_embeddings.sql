-- Step 1: rebuild chunks.embedding at 1024 dimensions (matches bge-m3,
-- multilingual-e5-large, mxbai-embed-large and OpenAI text-embedding-3-*
-- via the `dimensions` parameter).
DROP INDEX IF EXISTS chunks_embedding_idx;

ALTER TABLE chunks
  ALTER COLUMN embedding TYPE vector(1024)
  USING NULL;

CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

-- Step 2: add an embedding column to entities so people/projects/tags and
-- all other knowledge-graph nodes are semantically retrievable.
ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS embedding vector(1024),
  ADD COLUMN IF NOT EXISTS embedding_source TEXT,
  ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS entities_embedding_idx
  ON entities USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;
