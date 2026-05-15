CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('person', 'project', 'topic', 'decision', 'insight', 'question', 'tag', 'document')),
  name TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (type, canonical_name)
);

CREATE TABLE IF NOT EXISTS entity_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  excerpt TEXT,
  confidence REAL NOT NULL DEFAULT 0.75,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_id, document_id, excerpt)
);

CREATE TABLE IF NOT EXISTS knowledge_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK (
    relation_type IN (
      'mentioned_with',
      'belongs_to_project',
      'assigned_to',
      'decided_in',
      'insight_about',
      'question_about',
      'tagged_as',
      'document_mentions'
    )
  ),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  evidence_excerpt TEXT,
  confidence REAL NOT NULL DEFAULT 0.7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_entity_id, target_entity_id, relation_type, document_id)
);

CREATE INDEX IF NOT EXISTS entities_type_idx ON entities (type);
CREATE INDEX IF NOT EXISTS entities_canonical_name_idx ON entities (canonical_name);
CREATE INDEX IF NOT EXISTS entity_mentions_document_idx ON entity_mentions (document_id);
CREATE INDEX IF NOT EXISTS knowledge_edges_source_idx ON knowledge_edges (source_entity_id);
CREATE INDEX IF NOT EXISTS knowledge_edges_target_idx ON knowledge_edges (target_entity_id);
CREATE INDEX IF NOT EXISTS knowledge_edges_relation_idx ON knowledge_edges (relation_type);
