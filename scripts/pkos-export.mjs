#!/usr/bin/env node
// PKOS workspace export.
//
// Usage:
//   node scripts/pkos-export.mjs --out backup.tar.gz [--include-trashed]
//
// Produces a tar.gz with:
//   manifest.json           — schema version + counts + creation time
//   documents.jsonl         — one document row per line (with metadata)
//   entities.jsonl
//   action_items.jsonl
//   comments.jsonl
//   attachments.jsonl       — pointers to assets/<id>/
//   assets/<attachment-id>/<filename>  — binary blobs
//
// Hard rules: read-only on the database, append-only on the tar stream,
// idempotent metadata (running twice produces byte-equal manifest minus
// the timestamp). pg_dump still beats this for raw DB recovery; this
// archive is portable across PKOS versions.

import { createWriteStream } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createGzip } from 'node:zlib'
import pg from 'pg'
import * as tar from 'tar'

const args = parseArgs(process.argv.slice(2))
const outPath = args.out || 'pkos-backup.tar.gz'
const includeTrashed = Boolean(args['include-trashed'])
const filesPath = resolve(process.env.PKOS_FILES_PATH || './files')

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

try {
  console.log(`[pkos-export] writing ${outPath}…`)
  const stagingRoot = await stage(client, filesPath, includeTrashed)

  await new Promise((res, rej) => {
    tar.c({ gzip: true, cwd: stagingRoot, file: outPath }, ['.'])
      .then(res, rej)
  })
  console.log(`[pkos-export] done.`)
} finally {
  await client.end()
}

async function stage(client, filesPath, includeTrashed) {
  const root = `/tmp/pkos-export-${Date.now()}`
  await mkdir(root, { recursive: true })

  const tables = [
    ['documents', `SELECT * FROM documents ${includeTrashed ? '' : 'WHERE deleted_at IS NULL'} ORDER BY created_at`],
    ['entities', `SELECT * FROM entities ${includeTrashed ? '' : 'WHERE deleted_at IS NULL'} ORDER BY created_at`],
    ['action_items', `SELECT * FROM action_items ${includeTrashed ? '' : 'WHERE deleted_at IS NULL'} ORDER BY created_at`],
    ['comments', `SELECT * FROM comments ${includeTrashed ? '' : 'WHERE deleted_at IS NULL'} ORDER BY created_at`],
    ['entity_mentions', `SELECT * FROM entity_mentions ORDER BY created_at`],
    ['knowledge_edges', `SELECT * FROM knowledge_edges ORDER BY created_at`],
    ['document_attachments', `SELECT * FROM document_attachments WHERE deleted_at IS NULL ORDER BY created_at`]
  ]

  const counts = {}
  for (const [name, sql] of tables) {
    const res = await client.query(sql)
    counts[name] = res.rowCount
    const lines = res.rows.map((row) => JSON.stringify(row)).join('\n')
    await writeFile(join(root, `${name}.jsonl`), lines)
  }

  // Copy referenced files into assets/<storage_path>.
  const assets = await client.query(`SELECT id, storage_path, filename FROM document_attachments WHERE deleted_at IS NULL`)
  for (const row of assets.rows) {
    const sourcePath = join(filesPath, row.storage_path)
    const destPath = join(root, 'assets', row.storage_path)
    await mkdir(join(root, 'assets', dirname(row.storage_path)), { recursive: true })
    try {
      const data = await readFile(sourcePath)
      await writeFile(destPath, data)
    } catch (error) {
      console.warn(`[pkos-export] missing file ${sourcePath}: ${error.message}`)
    }
  }

  await writeFile(join(root, 'manifest.json'), JSON.stringify({
    schema: 'pkos.v1',
    exported_at: new Date().toISOString(),
    include_trashed: includeTrashed,
    counts
  }, null, 2))

  return root
}

function dirname(path) { const i = path.lastIndexOf('/'); return i < 0 ? '' : path.slice(0, i) }

async function writeFile(path, data) {
  const fs = await import('node:fs/promises')
  await fs.writeFile(path, data)
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token.startsWith('--')) {
      const key = token.slice(2)
      const next = argv[i + 1]
      if (!next || next.startsWith('--')) out[key] = true
      else { out[key] = next; i++ }
    }
  }
  return out
}
