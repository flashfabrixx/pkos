# BKOS - Business Knowledge Operating System

Business knowledge capture, processing, retrieval, and action tracking.

## Purpose

BKOS turns meeting transcripts, voice notes, and business reflections into a queryable business knowledge base.

The first version should stay narrow:

- capture text and transcript inputs
- extract summaries, people, projects, decisions, insights, and action items
- store human-readable notes
- index content for semantic search
- provide a web UI for inbox, query, and open actions

## Quick Start

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3000`.

For a stable named local URL while the dev server is running:

```bash
pnpm dev:portless
```

Then open `http://bkos.localhost:1355`.

Default development credentials come from `.env.example`:

- username: `marcel`
- password: `change-me`

Change them in `.env` before deploying anywhere.

## Repository Structure

```text
bkos/
  apps/
    web/          # Web UI: inbox, search, actions, topics
    api/          # Capture, analysis, retrieval, auth
  packages/
    core/         # Domain schemas and shared types
    ingest/       # Text and transcript parsing
    retrieval/    # Search and RAG abstractions
  infra/
    migrations/   # Database migrations
    deploy/       # Deployment configuration
  docs/
    adr/          # Architecture decision records
```

## Relationship To PKOS

BKOS is intentionally separate from PKOS.

PKOS remains the personal knowledge and operations system. BKOS owns business-specific capture, auth, data classification, retrieval, and action tracking.

Reusable ideas from PKOS:

- markdown notes as durable, human-readable source material
- Postgres and pgvector for hybrid retrieval
- structured extraction for people, projects, action items, decisions, and insights
- local-first processing where practical

Shared code should be extracted only after stable boundaries emerge.

## BKOS v1 Scope

The first vertical slice implements:

- single-user password login with signed session cookie
- capture form for business notes and transcripts
- deterministic placeholder extraction for summaries, people, projects, action items, decisions, insights, open questions, and tags
- Postgres persistence with explicit SQL migrations
- pgvector-ready chunks table
- Markdown archive output under `BKOS_VAULT_PATH`
- document detail view
- search view using Postgres text search and fallback matching
- action list with status updates

LLM extraction and embedding generation are intentionally behind a future interface. The app works without an LLM provider.

## UI Direction

The first screen is a focused capture workspace, not a landing page or analytics dashboard.

It prioritizes:

- global search in the top navigation
- a large transcript input as the primary action
- required source, date, and confidentiality fields directly below capture
- lightweight open action and recent document counts
- recent documents as supporting context
- direct access to actions and the knowledge graph through navigation

The UI uses Tailwind CSS for layout/utilities and Heroicons for navigation/status icons. Existing plain CSS remains for a few app-specific primitives while the interface is migrated incrementally.

## Open Source And API Direction

BKOS is intended to become open source early. Code, docs, and module boundaries should assume outside readers and future contributors.

Near-term conventions:

- keep configuration in `.env.example` without secrets
- document architecture decisions in `docs/adr`
- prefer explicit database migrations and typed server boundaries
- keep capture, extraction, archive, retrieval, graph, and action workflows modular

Future API work should add browser-accessible API documentation, ideally generated from route schemas, so external tools, skills, MCP servers, and systems such as Paperarchive can integrate without reading Nuxt internals.

## BKOS v1.1 Knowledge Graph

BKOS also builds a first native knowledge graph:

- canonical `entities` for documents, people, projects, decisions, insights, questions, tags, and topics
- `entity_mentions` with document evidence and confidence
- typed `knowledge_edges` such as `document_mentions`, `belongs_to_project`, `assigned_to`, `decided_in`, `insight_about`, and `question_about`
- Obsidian-compatible wikilinks in Markdown archive files
- graph API at `/api/graph`
- graph view at `/graph`

The graph extractor is deterministic for now. LLM-based entity and relation extraction should be added behind the same schema later.
