CREATE TABLE IF NOT EXISTS entity_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entity_activities_entity_idx
  ON entity_activities (entity_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS entity_activities_kind_idx
  ON entity_activities (kind);
