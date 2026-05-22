-- Phase 4 of the Claude-workbench plan: curated memory-facts per
-- entity. The user maintains short bullet points for each person /
-- project / tag that get auto-injected into the chat context whenever
-- the entity surfaces in retrieval. Cheaper than rebuilding context
-- from raw captures every turn, and editable by hand so the user
-- stays in control of what the model "remembers" about them.

CREATE TABLE IF NOT EXISTS entity_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  -- Sort key for the UI list. Newer rows go to the end by default
  -- (position = max + 1); the user can reorder. Floats would be more
  -- elegant for in-between inserts but a plain int and a renumber
  -- pass on reorder is simpler and easy enough at this scale.
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entity_facts_entity_idx
  ON entity_facts (entity_id, position, created_at);
