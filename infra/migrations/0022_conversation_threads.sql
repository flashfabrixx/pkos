-- Phase 2 of the Claude-workbench plan: persistent multi-turn chat
-- threads inside PKOS. Each thread anchors a conversation; each turn
-- (user + assistant) is a row in conversation_messages. Assistant
-- messages keep their RAG sources, model + provider, and token
-- accounting so we can render the same answer offline later and bill
-- per-thread if we ever want to.

CREATE TABLE IF NOT EXISTS conversation_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'New thread',
  -- Routing slug consumed by the chat util. Defaults to whatever
  -- runtimeConfig says today (typically a Haiku/Sonnet variant via
  -- OpenRouter). The user can override per thread from the UI.
  model TEXT NOT NULL DEFAULT 'openrouter/anthropic/claude-sonnet-4-6',
  -- Optional system-prompt override stored verbatim. NULL = use the
  -- baseline PKOS chat system prompt.
  system_prompt TEXT,
  -- Bag for forward-compatible config: pinned_entity_ids, retrieval
  -- top_k, filters, etc. Keeps schema migrations cheap.
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS conversation_threads_updated_idx
  ON conversation_threads (updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS conversation_threads_archived_idx
  ON conversation_threads (archived_at)
  WHERE deleted_at IS NULL AND archived_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES conversation_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  -- Assistant-only: the RAG sources surfaced for this answer. Shape
  -- mirrors what /api/v1/chat returns - {documentId, title,
  -- sourceType, capturedAt, excerpt, score}. Stored as JSONB so the
  -- UI can render them verbatim later.
  sources JSONB,
  -- Assistant-only: which model produced this turn. May differ from
  -- the thread default if the user switched models mid-conversation.
  model TEXT,
  provider TEXT,
  tokens_in INT,
  tokens_out INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_messages_thread_idx
  ON conversation_messages (thread_id, created_at);

-- Touch the parent thread whenever a new message lands so the
-- "Recently active" listing on the index page actually reflects
-- activity, not just thread creation.
CREATE OR REPLACE FUNCTION conversation_messages_touch_thread()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversation_threads
     SET updated_at = now()
   WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS conversation_messages_touch_thread_trg ON conversation_messages;
CREATE TRIGGER conversation_messages_touch_thread_trg
  AFTER INSERT ON conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION conversation_messages_touch_thread();
