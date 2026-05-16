# Changelog

All notable changes to BKOS that affect operators or users. Each entry is
keyed by the sprint batch from [roadmap-v1.md](./roadmap-v1.md).

## Unreleased

### B2 — Observability
- Structured JSON logger (`pino`) at `apps/web/server/utils/logger.ts`. Dev
  output is pretty-printed; production is JSON for journald / Loki / etc.
- `02.request-log` middleware binds a child logger per request keyed by
  `x-request-id` (echoed back on the response) and emits one completion
  log line with method, status and duration.
- `GET /healthz` (liveness: process up + DB round-trip) and `GET /readyz`
  (readiness: DB, migrations applied, vault writable, embedding provider
  reachable when configured). Both return JSON either way; non-OK is 503.
- All previous `console.warn` / `console.error` sites in
  `security-boot-check`, `error-handler`, `auth/login`, `summarize-entity`
  and `embedding` switched to the structured logger.
- New `LOG_LEVEL` env var; defaults to `info` in prod and `debug` else.

### B0-TEST — Test infrastructure
- Vitest + Testcontainers configuration at the repo root
  (`vitest.config.ts`); `pnpm test`, `pnpm test:watch` and `pnpm test:cov`
  scripts wired up.
- `apps/web/test/setup/pg.ts` spins up a `pgvector/pgvector:pg16` container,
  applies every migration in order, and provides a `withTx` helper that
  rolls back per test.
- Initial coverage of merged surfaces: password util, canonicalize util,
  language detection, migration suite smoke, soft-delete invariants and
  entity-merge SQL contract.
- `docs/contributing.md` documents the workflow.

### B1 — Soft-Delete & Reprocessing
- New migration `0013_soft_delete.sql` adds `deleted_at` to documents,
  entities, action_items and comments plus partial indexes for live and
  trashed rows.
- All list and detail endpoints now filter rows where `deleted_at IS NULL`.
  Counts and last-seen aggregates exclude trashed documents.
- `DELETE` endpoints for captures, entities, actions and comments now
  perform a soft delete (set `deleted_at = now()`).
- New `POST /api/documents/:id/reprocess` re-runs the extraction pipeline
  in-place, replacing chunks, mentions, edges and extracted items.
- New `/trash` page with a sidebar entry; supports restore and permanent
  delete via `POST /api/trash/restore` and `POST /api/trash/purge`.
- Capture detail page gains *Reprocess* and *Delete* buttons in the
  header.
