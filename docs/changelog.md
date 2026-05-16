# Changelog

All notable changes to BKOS that affect operators or users. Each entry is
keyed by the sprint batch from [roadmap-v1.md](./roadmap-v1.md).

## Unreleased

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
