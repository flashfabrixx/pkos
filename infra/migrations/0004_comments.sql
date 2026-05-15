CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comments_entity_idx ON comments (entity_id);
CREATE INDEX IF NOT EXISTS comments_document_idx ON comments (document_id);
CREATE INDEX IF NOT EXISTS comments_created_idx ON comments (created_at);
