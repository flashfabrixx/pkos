-- Workspace audit log (B14). Append-only record of security-relevant and
-- high-stakes write operations. The `actor` column is TEXT today (single
-- BKOS_USERNAME or an api_key id) so the schema survives a future
-- migration to a users table.

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor TEXT,
  action TEXT NOT NULL,
  resource_kind TEXT,
  resource_id UUID,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip INET,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_occurred_idx ON audit_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_action_idx ON audit_events (action);
