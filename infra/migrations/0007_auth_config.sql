CREATE TABLE IF NOT EXISTS auth_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  totp_secret_encrypted TEXT,
  backup_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT auth_config_singleton CHECK (id = 1)
);

INSERT INTO auth_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
