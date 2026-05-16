-- Soft-delete columns. Existing rows stay "live" (deleted_at IS NULL).
ALTER TABLE documents    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE entities     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE comments     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Hot-path filters all check "deleted_at IS NULL". Partial indexes keep the
-- live working set cheap to scan without breaking trash queries.
CREATE INDEX IF NOT EXISTS documents_live_created_at_idx
  ON documents (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS documents_deleted_at_idx
  ON documents (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS entities_live_type_idx
  ON entities (type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS entities_deleted_at_idx
  ON entities (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS action_items_live_status_idx
  ON action_items (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS action_items_deleted_at_idx
  ON action_items (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS comments_live_entity_idx
  ON comments (entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS comments_deleted_at_idx
  ON comments (deleted_at) WHERE deleted_at IS NOT NULL;
