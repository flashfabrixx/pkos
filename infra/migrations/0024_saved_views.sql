-- Phase 5: saved views. The user often runs the same hybrid search
-- with the same filters (e.g. "all reflections about Anna in the last
-- 30 days") and wants a one-click way back. A saved view is the
-- minimum durable shape: a name + the canonical search params that
-- the /search page already accepts. The UI just hydrates the form
-- from these values and re-runs the search.

CREATE TABLE IF NOT EXISTS saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  q TEXT NOT NULL DEFAULT '',
  -- Filters mirror /api/search query params (kinds, lang, from, to,
  -- limit). JSONB keeps the schema forward-compatible without a
  -- migration whenever the search surface grows another knob.
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS saved_views_active_idx
  ON saved_views (deleted_at, updated_at DESC);
