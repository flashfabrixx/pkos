# Backup & restore

BKOS ships two complementary backup paths. Pick the one that matches
your operational style.

## A. Portable JSONL archive — `bkos:export`

Recommended for migrating between hosts or upgrading across versions.
Survives a Postgres upgrade because the schema stays at the
application's `bkos.v1` shape.

```bash
pnpm bkos:export --out backup-$(date +%F).tar.gz
# optional: include rows currently in the trash
pnpm bkos:export --out backup.tar.gz --include-trashed
```

The tarball contains:

- `manifest.json` — schema version, timestamp, row counts
- `documents.jsonl`, `entities.jsonl`, `action_items.jsonl`, `comments.jsonl`,
  `entity_mentions.jsonl`, `knowledge_edges.jsonl`, `document_attachments.jsonl`
- `assets/<storage_path>` — file blobs referenced from `document_attachments`

### Restoring

```bash
DATABASE_URL=postgres://… pnpm bkos:import --in backup.tar.gz
# preview without writing
DATABASE_URL=postgres://… pnpm bkos:import --in backup.tar.gz --dry-run
```

The import is idempotent on `id`: rows that already exist are updated
with the archive's payload. Run it twice if you need to.

## B. Raw Postgres dump — `pg_dump`

Use this when you want byte-exact recovery onto the same Postgres
major version. Faster than the JSONL path for big workspaces.

```bash
pg_dump --format=custom --file=bkos.pgdump "$DATABASE_URL"
# restore:
createdb bkos
pg_restore --dbname=bkos --no-owner --no-privileges bkos.pgdump
```

Don't forget to back up the **files** directory (`BKOS_FILES_PATH`)
alongside the database — attachments live there, not inside Postgres.

## C. Markdown vault

The vault directory (`BKOS_VAULT_PATH`) already contains one Markdown
file per capture, written by the pipeline. It's not a complete backup
(it lacks entities, edges, comments, etc.) but is a great
human-readable archive for read-only use cases like Obsidian.

```bash
rsync -a "$BKOS_VAULT_PATH"/ /your/backup/dest/
```
