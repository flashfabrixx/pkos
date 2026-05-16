# Changelog

All notable changes to BKOS that affect operators or users. Each entry is
keyed by the sprint batch from [roadmap-v1.md](./roadmap-v1.md).

## Unreleased

### B15 — Outgoing webhooks
- Migration `0020_webhooks.sql` adds `webhook_subscriptions` and
  `webhook_deliveries` (with partial index on pending rows).
- `utils/events.ts` `emitEvent(type, payload)` enqueues one delivery
  per matching active subscription (`events[]` empty = subscribe to all).
- `utils/webhook-deliver.ts` HMAC-SHA-256 signs the body, POSTs with an
  8s timeout. Failures back off exponentially (1m, 2m, 4m, 8m, 16m); the
  5th failure deactivates the subscription.
- Nitro scheduled task `webhook:retry` every minute drains the queue.
- Endpoints: `GET /api/settings/webhooks`, `POST` (returns secret
  exactly once), `DELETE /api/settings/webhooks/:id`.
- `/settings/webhooks` page for managing subscriptions.
- Audit events `webhook.subscribe` / `webhook.unsubscribe`.
- Initial emit sites: `capture.created` and `capture.processed` in the
  document-create endpoint; additional sites land as integrations need them.

### B14 — Workspace audit log
- Migration `0019_audit_events.sql` adds the append-only `audit_events`
  table with index on `occurred_at DESC`.
- `utils/audit.ts` exposes `recordAudit({event, actor, action, resourceKind, resourceId, meta})`
  with best-effort write semantics (logs and swallows errors).
- Hook sites: login success + failure, logout, api-key create + revoke,
  document soft-delete, entity soft-delete, entity merge.
- New endpoints: `GET /api/admin/audit` (filterable, paginated) and
  `GET /api/admin/audit.csv` (capped at 10k rows).
- New page `/admin/audit` with filter input and CSV download.

### B11-13 — UI polish (i18n + responsive + dark mode)
- **Tokens**: `:root` extended with a full surface/text/border/accent
  token set, plus a `:root[data-theme="dark"]` override and a
  `prefers-color-scheme: dark` fallback. About 50 high-traffic hex
  literals migrated to tokens (full migration is incremental).
- **Theme toggle**: `useTheme()` composable persists choice in
  `localStorage`; sidebar footer button cycles system → light → dark.
- **Responsive**: mobile menu button + off-canvas drawer below 900px;
  viewport meta wired in `nuxt.config.app.head`.
- **i18n**: `vue-i18n` plugin with bundled `en.json` and `de.json`
  message catalogs; first-visit default reads `navigator.language` and
  later honours `localStorage.bkos.locale`. Sidebar labels migrated;
  remaining strings extracted incrementally. `useLocaleSwitch()`
  composable + chip toggle in the footer.
- Bundle-parity Vitest spec keeps EN and DE keys in lockstep.

### B10 — Action reminders
- `utils/mailer.ts`: cached nodemailer transport built from SMTP env;
  no-op transport (logs intended send) when SMTP_HOST is unset.
- `utils/action-reminder.ts` queries open actions with due_date ≤ today,
  groups overdue vs today and composes a plain-text digest.
- Nitro scheduled task `reminders:actions` runs daily at 07:00.
- New env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`,
  `SMTP_SECURE`, `SMTP_FROM`, `BKOS_REMINDER_EMAIL`.

### B9 — Onboarding wizard
- Migration `0018_setup_state.sql` adds a singleton `setup_state` row.
- `utils/setup-state.ts` caches the completion flag for 30s and
  invalidates on `markSetupComplete()`.
- New middleware `03.onboarding.ts`: redirects browsers to `/setup`
  until the wizard finishes; API and auth routes still respond as usual.
- New endpoints: `/api/setup/status`, `/api/setup/test-embedding`,
  `/api/setup/complete`.
- New page `/setup` (empty layout) shows session-secret, password and
  embedding-provider status with actionable hints, plus follow-up
  pointers (2FA, API keys, mail).

### B8 — Entity-link suggestions
- Migration `0017_entity_link_suggestions.sql` adds a per-source
  candidate table with score, reason, accepted_at, dismissed_at.
- `utils/suggest-links.ts` recomputes top-5 cosine neighbours per
  entity above a 0.78 floor; dismissed pairs honour a 30-day cooldown.
- Nitro scheduled task `suggestions:entities` runs daily at 02:00.
- `GET /api/entities/:id/suggestions`,
  `POST /api/entities/suggestions/:id/accept`,
  `POST /api/entities/suggestions/:id/dismiss`.
- `EntitySuggestions.vue` mounted in the entity detail sidebar; emits a
  `merge` event for parent pages to wire up the existing merge dialog.

### B7 — Hybrid search UI
- `/api/search` now embeds the query (when a provider is configured)
  and ranks chunks by `0.6 · (1 − cosine) + 0.4 · ts_rank`. Falls back
  to lexical-only when embeddings aren't available.
- Accepts `kinds`, `lang`, `from`, `to` filters; returns
  `mode: 'hybrid' | 'lexical' | 'idle'` so the UI can show how the
  results were ranked.
- `/search` page adds kind chips, language picker, date range and a
  mode indicator.

### B6 — Web clipper (bookmarklet)
- New `POST /api/v1/captures/url`: accepts `{url, selection?, title?}`,
  re-fetches the page via the SSRF-safe `utils/url-fetch.ts` helper,
  composes selection + meta description into a capture, then runs the
  standard pipeline.
- `utils/url-fetch.ts`: hostname must resolve to a public IP (loopback,
  RFC1918, link-local, IPv6 ULA all blocked); response size capped at
  5 MB; 8s timeout; final-URL re-checked after redirects.
- New page `/settings/clipper` shows a draggable "Save to BKOS"
  bookmarklet pre-filled with the chosen API key and the host origin.
- Vitest spec for the SSRF guard.

### B5 — Email-to-inbox (IMAP)
- Migration `0016_email_ingest.sql` adds `email_ingest_log` for
  message-id dedupe.
- `apps/web/server/utils/email-ingest.ts` ingests structured incoming
  emails through the existing capture pipeline; sender allow-list +
  attachment routing via the B4 file store.
- `apps/web/server/utils/imap.ts` polls INBOX via `imapflow` /
  `mailparser`, marks messages Seen on success.
- `apps/web/server/tasks/email-poll.ts` registered as a Nitro scheduled
  task at `*/5 * * * *`; no-op when `MAIL_HOST` is empty.
- New env: `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`,
  `MAIL_SECURE`, `MAIL_FROM_ALLOW`.
- `docs/email-setup.md` covers self-hosted (Postal, Haraka/Dovecot) and
  cloud-mailbox setups.

### B4 — File uploads + extraction
- Migration `0015_attachments.sql` adds `document_attachments` with sha256,
  size, mime and storage path; cascades on document delete.
- `apps/web/server/utils/storage.ts`: pluggable `FileStore` interface with a
  local-disk implementation under `BKOS_FILES_PATH` (sharded by first two
  hex chars of the file id).
- `apps/web/server/utils/file-extract.ts`: best-effort text extraction —
  text/* verbatim, PDF via `pdfjs-dist`, DOCX via `mammoth`. Falls back to
  null rather than throwing so an upload still creates a capture.
- `POST /api/v1/captures/upload`: multipart endpoint with max size guard
  (default 25 MB) and mime allow-list (PDF, JSON, XML, DOCX, Markdown,
  text, CSV, common images).
- Capture page now routes single-file PDF drops through the upload
  endpoint and navigates to the new capture; text formats keep the
  existing client-side flow.
- New env: `BKOS_FILES_PATH=./files`, `BKOS_MAX_UPLOAD_MB=25`.

### B3 — REST API v1 + API keys
- Migration `0014_api_keys.sql` adds the `api_keys` table (`prefix`,
  scrypt-hashed secret, scopes, actor, last-used, revoked-at).
- `apps/web/server/utils/api-keys.ts` generates `bkos_<prefix>_<secret>`
  tokens; only prefix + hash are persisted.
- `apps/web/server/utils/auth.ts` gains `getApiKeyAuth` and
  `requireAuthOrApiKey(scope?)` — accepts session cookie *or* Bearer key.
- Public REST surface: `POST /api/v1/captures`, `GET /api/v1/captures/:id`,
  `GET /api/v1/entities` (filterable, paginated).
- Settings page gains a key-management section; revocation is soft so
  history survives.
- New `docs/api.md` reference.

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
