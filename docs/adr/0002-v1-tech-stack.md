# ADR-0002: PKOS v1 Tech Stack

**Status:** Accepted
**Date:** 2026-05-15

## Context

PKOS v1 needs a working vertical slice: login, capture, processing, durable storage, Markdown archive, search, and action tracking.

The system should avoid becoming a distributed AI platform before the core workflow is validated.

## Decision

Use Nuxt 4 as the fullstack application in `apps/web`.

Use Postgres as the primary database and pgvector-ready schema for future embeddings. Keep vector search optional in v1 and rely on Postgres text search until embeddings are wired.

Use Markdown artifacts as a human-readable archive under a configurable local vault path. Obsidian can open that vault, but the app does not depend on Obsidian.

Use explicit SQL migrations in `infra/migrations`.

Keep extraction deterministic for v1, with a clean package boundary in `packages/ingest` for a future LLM extractor.

## Consequences

Positive:

- one runtime for the first product slice
- clear deployment path
- no external vector database
- no Python backend until the AI pipeline justifies it
- database remains the operational source of truth

Tradeoff:

- placeholder extraction is intentionally limited
- embedding generation and LLM-based extraction remain future work
