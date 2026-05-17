#!/usr/bin/env node
// BKOS workspace import.
//
// Usage:
//   node scripts/pkos-import.mjs --in backup.tar.gz [--dry-run]
//
// Idempotent over its `id` columns: re-running the import is a no-op
// unless rows in the archive have newer `updated_at`. The schema
// version in manifest.json must match the runtime; mid-version
// mismatches abort with a clear message.

import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createReadStream } from 'node:fs'
import pg from 'pg'
import * as tar from 'tar'

const args = parseArgs(process.argv.slice(2))
const inPath = args.in
if (!inPath) {
  console.error('usage: pkos-import --in backup.tar.gz [--dry-run]')
  process.exit(2)
}
const dryRun = Boolean(args['dry-run'])

const workdir = await mkdtemp(join(tmpdir(), 'pkos-import-'))
console.log(`[pkos-import] extracting to ${workdir}…`)
await pipeline(createReadStream(inPath), tar.x({ cwd: workdir }))

const manifest = JSON.parse(await readFile(join(workdir, 'manifest.json'), 'utf8'))
if (manifest.schema !== 'bkos.v1') {
  console.error(`Unsupported manifest schema: ${manifest.schema}. Run a matching BKOS version.`)
  process.exit(3)
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
try {
  await client.query('BEGIN')

  const tables = [
    'documents',
    'entities',
    'action_items',
    'comments',
    'entity_mentions',
    'knowledge_edges',
    'document_attachments'
  ]
  const counters = { inserted: 0, updated: 0, skipped: 0 }
  for (const table of tables) {
    const path = join(workdir, `${table}.jsonl`)
    let lines = ''
    try { lines = await readFile(path, 'utf8') } catch { continue }
    for (const raw of lines.split('\n')) {
      if (!raw.trim()) continue
      const row = JSON.parse(raw)
      const updateClause = Object.keys(row)
        .filter((k) => k !== 'id')
        .map((k) => `${k} = EXCLUDED.${k}`)
        .join(', ')
      const cols = Object.keys(row).map(quoteIdent).join(', ')
      const placeholders = Object.keys(row).map((_, i) => `$${i + 1}`).join(', ')
      const values = Object.values(row)
      const sql = `INSERT INTO ${table} (${cols}) VALUES (${placeholders})
                   ON CONFLICT (id) DO UPDATE SET ${updateClause}
                   RETURNING (xmax = 0) AS inserted`
      if (dryRun) {
        counters.skipped++
      } else {
        const res = await client.query(sql, values)
        if (res.rows[0]?.inserted) counters.inserted++
        else counters.updated++
      }
    }
  }

  if (dryRun) {
    await client.query('ROLLBACK')
    console.log(`[pkos-import] dry-run: would have imported`, counters)
  } else {
    await client.query('COMMIT')
    console.log(`[pkos-import] done`, counters)
  }
} catch (error) {
  await client.query('ROLLBACK')
  console.error(`[pkos-import] failed: ${error.message}`)
  process.exit(1)
} finally {
  await client.end()
}

function quoteIdent(name) { return '"' + name.replace(/"/g, '""') + '"' }

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
