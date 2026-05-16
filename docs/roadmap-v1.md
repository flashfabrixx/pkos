# BKOS Roadmap — Public 1.0 / 1.1

Sprint-Plan für die Must-have- und Should-have-Features bis zur ersten öffentlichen
Self-host-Version. Jeder Batch ist als eigener Worktree-PR vorgesehen und
liefert isoliert einen abgeschlossenen Wert.

Status-Legende: `todo` / `wip` / `done`

---

## Sprint 1 — Foundation & API-Surface

Stabilisiert den Kern, bevor neue Eingänge angeflanscht werden. Alle weiteren
Sprints bauen auf dem Logger, Health-Endpoint und den API-Keys auf.

### B0-TEST — Test infrastructure  `done`
- Vitest + Testcontainers; `pnpm test` runs unit + integration suites.
- Setup helpers at `apps/web/test/setup/pg.ts`.
- Initial coverage of B1 surface; every later batch extends.

### B1 — Soft-Delete & Reprocessing  `done`
- Migration: `deleted_at` Spalte auf `documents`, `entities`, `action_items`,
  `comments`. Filter in allen Listen/Detail-Endpoints.
- `POST /api/documents/:id/reprocess` (Status zurück auf `queued`,
  Pipeline-Trigger), inkl. UI-Button in der Capture-Detail-Seite.
- Trash-Seite (`/trash`) mit Restore- und Permanent-Delete-Aktion.
- Bestehende `DELETE`-Endpoints auf Soft-Delete umstellen.

### B2 — Observability  `done`
- Pino-Logger als Nitro-Plugin, ersetzt `console.*` in der App.
- `/healthz` (DB, pgvector, Embedding-Provider) und `/readyz` (Migrationen
  durch, Worker erreichbar).
- Strukturierte Request-Logs mit `req_id` und Auth-Subject.
- Docker-Compose Healthcheck auf `/healthz` einrichten.

### B3 — REST-API & API-Keys  `done`
- Migration: `api_keys` Tabelle (`id`, `name`, `hashed_key`, `prefix`,
  `scopes`, `last_used_at`, `created_at`, `revoked_at`).
- Auth-Middleware: Cookie *oder* `Authorization: Bearer bkos_*` für `/api/v1/**`.
- Versionierte Public-API unter `/api/v1`: `POST /captures`,
  `GET /captures/:id`, `GET /entities`, `POST /entities`.
- Settings-Seite zum Erstellen/Widerrufen von Keys (Key nur einmalig sichtbar).
- Doku `docs/api.md` mit cURL-Beispielen.

---

## Sprint 2 — Capture-Eingänge

Senkt die Hürde, etwas in BKOS reinzubekommen. Ab hier wird das Tool
wirklich „Knowledge Capture" statt nur „Knowledge Viewer".

### B4 — Datei-Uploads  `done`
- `POST /api/v1/captures/upload` (multipart, max-size-config).
- Storage-Abstraktion `apps/web/server/utils/storage.ts` (lokal +
  S3-Interface-stub für später).
- PDF-Textextraktion via `pdfjs-dist` oder `pdf-parse`.
- Bild-OCR optional, hinter `OCR_ENABLED`-Flag (Tesseract local oder
  Vision-Provider).
- UI: Drag-and-Drop in der Capture-Inbox.

### B5 — Email-Inbox  `done`  *(braucht B3, optional B4)*
- IMAP-Poller als Nitro-Scheduled-Task (`mailparser`-basiert), Konfig via
  ENV (`MAIL_HOST`, `MAIL_USER`, …).
- Mapping: Sender → Person-Entity (Auto-Match), Subject → Title, Body →
  Content, Attachments → File-Captures (über B4).
- Allow-List für Absender-Domains.
- Fallback: SMTP-Eingang via Postal/Haraka-Beispiel in `docs/email-setup.md`.

### B6 — Web-Clipper  `done`  *(braucht B3)*
- Bookmarklet, das aktuelle URL + Selection + Page-Title an
  `POST /api/v1/captures` schickt. Konfigurierbar über `/settings/clipper`.
- Optional: Minimal-Chrome-Extension (MV3) mit gleichem Endpoint.
- Server-seitige URL-Anreicherung (Open-Graph-Daten, Reader-Mode-Text via
  `@mozilla/readability`).

---

## Sprint 3 — Discovery

Embeddings liegen bereits vor — diese Phase macht sie für den User sichtbar.

### B7 — Such-UI  `done`
- Neue Seite `/search` mit kombinierter semantischer + Volltext-Suche.
- Server: `POST /api/search`, parametrisiert nach `q`, `kinds`, `lang`,
  `date_from/to`, `entity_id`. Hybrid-Score (Cosine + TSV-Rank, gewichtet).
- Trefferliste mit Snippet-Highlighting und Entity-Chips.
- Command-Palette schickt Volltext-Abfragen an dieselbe API.

### B8 — Entity-Vorschläge  `done`
- Migration: `entity_link_suggestions` (`source_id`, `target_id`,
  `score`, `reason`, `dismissed_at`, `accepted_at`).
- Background-Job (Cron, täglich): Top-N ähnliche Entities per Cosine pro
  Entity berechnen, Schwellwert konfigurierbar.
- UI-Tab „Suggestions" in der Entity-Detail-Seite, mit Accept/Dismiss
  (Accept → Merge-Dialog wiederverwenden).
- Optional: Suggestions auch zwischen Captures (für „ähnliche Notizen").

---

## Sprint 4 — Workflow & UX-Polish

Aus dem rohen Tool wird ein benutzbares Produkt für Self-Hoster.

### B9 — Onboarding-Wizard  `done`
- First-Run-Erkennung (kein User in DB) → `/setup`-Route.
- Schritte: Admin-User anlegen, SESSION_SECRET-Hinweis, Embedding-Provider
  testen, 2FA-Empfehlung, optional Mail-Konfig.
- Nach Abschluss: Setup-Lock-Flag in der DB, `/setup` wird `404`.

### B10 — Action-Reminders  `todo`
- Mail-Versand (`nodemailer`) via SMTP-Konfig.
- Cron: täglicher Digest pro User mit fälligen/überfälligen Actions.
- Optional: pro-Action „Remind me at…" Feld.
- Settings-Page für Reminder-Präferenzen.

### B11 — Internationalisierung DE/EN  `todo`
- `@nuxtjs/i18n` mit `en` und `de` Locale.
- Alle UI-Strings nach `i18n/<locale>.json` extrahieren.
- Locale-Switcher in der Sidebar; Default aus `navigator.language`.
- Datumsformate konsistent ans Locale binden (`formatBrowserDate`-Util erweitern).

### B12 — Responsive Pass  `todo`
- Sidebar wird auf `<lg` zum Off-Canvas-Drawer.
- Asana-Action-Table → vertikale Kartenliste auf `<640px`.
- Capture-Detail: Sidebar als Bottom-Sheet auf Mobile.
- Touch-Targets ≥ 40px, Tabellen horizontal scrollbar mit Fade.

### B13 — Dark Mode  `todo`
- CSS-Tokens (`--bg`, `--fg`, `--surface`, …) in `app.css` einführen,
  alle hard-coded Grautöne ersetzen.
- `prefers-color-scheme`-Default + manueller Toggle, Persistenz in
  `localStorage`.
- Heroicons bleiben tokenisiert (`currentColor`).

### B14 — Workspace-Audit-Log  `todo`
- Migration: `audit_events` (`actor_id`, `action`, `resource_kind`,
  `resource_id`, `meta`, `created_at`).
- Hook-Punkte: Login, Logout, 2FA-Setup, API-Key-Create/Revoke,
  Entity-Delete/Merge, Capture-Delete/Reprocess.
- `/admin/audit`-Seite mit Filter und CSV-Export.

---

## Sprint 5 — Integration & Hardening

Macht BKOS in fremde Stacks integrierbar und produktiv deploybar.

### B15 — Outgoing Webhooks  `todo`
- Migration: `webhook_subscriptions` (`url`, `secret`, `events`,
  `active`, `last_status`, `last_delivered_at`).
- Event-Bus (intern): `capture.created`, `capture.processed`,
  `action.created`, `action.completed`, `entity.merged`, …
- Delivery-Worker mit Retry (exponential backoff, max 5), HMAC-SHA-256-
  Signatur im `X-BKOS-Signature`-Header.
- Settings-Seite: Subscribe, Test-Delivery, Delivery-Log.

### B16 — Backup & Export  `todo`  *(braucht B1)*
- `pnpm bkos:export` CLI: Workspace → tar.gz mit `documents.jsonl`,
  `entities.jsonl`, `actions.jsonl`, `assets/` (Files aus B4).
- Markdown-Variante: Pro Capture ein `.md`-File mit Frontmatter.
- `bkos:import` als Gegenstück, idempotent über `external_id`.
- Doku in `docs/backup.md`, inkl. Postgres-Dump-Variante.

### B17 — Production-Deployment  `todo`
- `docker-compose.prod.yml`: Web + Postgres + (optional) Ollama, ohne
  exponierte DB-Ports, Volumes für Storage und PG-Data.
- Reverse-Proxy-Beispiel mit Caddy *und* Traefik in `infra/reverse-proxy/`.
- `docs/deployment.md`: VM-Setup in <15 Minuten, Backup-/Restore-Kapitel,
  Update-Prozedur.
- `.env.prod.example` mit allen produktionsrelevanten Variablen und
  Sicherheits-Hinweisen.

---

## Dependency-Übersicht

```
B1 ──┬─> B16
B2   │
B3 ──┼─> B5
     ├─> B6
     └─> B15 (optional, für Test-Delivery via API)
B4 ──┴─> B5 (Attachments)
Embedding-Pipeline ──> B7, B8
B1..B17 alle ──> B17 (Production-Deployment ganz zum Schluss)
```

## Reihenfolge & Cadence

Empfohlene Reihenfolge entspricht Sprint 1 → 5. Innerhalb eines Sprints
können parallele Worktrees laufen, solange sie nicht dieselben Dateien
berühren (z. B. B11/B12/B13 nicht gleichzeitig, da alle drei `app.css`
und viele Vue-Komponenten anfassen).

Jeder Batch endet mit:
1. Migration angewandt + Rollback-fähig (sofern Schemaänderung).
2. Mindestens manueller Smoke-Test der neuen Endpoints/Seiten.
3. Eintrag in `docs/changelog.md` (anzulegen mit B1).
4. README-Update, falls neue ENV-Variablen.
