-- File attachments (B4). One row per uploaded blob; cascades with its
-- parent document so trash + reprocess flows clean up automatically.

CREATE TABLE IF NOT EXISTS document_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  storage_path TEXT NOT NULL,
  checksum_sha256 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS document_attachments_doc_idx
  ON document_attachments (document_id) WHERE deleted_at IS NULL;
