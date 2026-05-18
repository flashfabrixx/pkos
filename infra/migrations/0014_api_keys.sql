-- API keys for programmatic access (B3).
--
-- Keys are emitted to the user as `pkos_<prefix>_<secret>` and only the
-- prefix + scrypt-hashed secret survive in this table. `actor` is the
-- string identity that "owns" the key — today always the single
-- BKOS_USERNAME, but the column is forward-compatible with a future
-- users.id migration.

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prefix CHAR(8) NOT NULL UNIQUE,
  hashed_key TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['captures:write','captures:read','entities:read']::TEXT[],
  actor TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS api_keys_active_idx
  ON api_keys (prefix) WHERE revoked_at IS NULL;
