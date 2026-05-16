-- Email ingest idempotency log (B5). Stores message-ids we've already
-- consumed so a poll re-running over the same INBOX never creates
-- duplicate captures. Kept in its own table so a future archive purge
-- can leave the log behind as evidence.

CREATE TABLE IF NOT EXISTS email_ingest_log (
  message_id TEXT PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  sender TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_ingest_log_received_idx ON email_ingest_log (received_at DESC);
