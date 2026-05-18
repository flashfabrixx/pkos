#!/usr/bin/env node
// Backfills embeddings for entities and chunks that don't have one yet.
// Reads provider config from the same env vars the app uses.
//
// Usage: pnpm db:embed [--limit=N]

import pg from 'pg'
import { readFileSync, existsSync } from 'node:fs'

const envPath = '.env'
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

const provider = (process.env.PKOS_EMBEDDING_PROVIDER || 'placeholder').toLowerCase()
if (provider === 'placeholder') {
  console.log('PKOS_EMBEDDING_PROVIDER is "placeholder" — nothing to backfill. Set it to "ollama" or "openai".')
  process.exit(0)
}

const ollamaUrl = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')
const embeddingModel = process.env.PKOS_EMBEDDING_MODEL || (provider === 'openai' ? 'text-embedding-3-small' : 'bge-m3')
const openAIKey = process.env.OPENAI_API_KEY || ''
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is required.')
  process.exit(1)
}
if (provider === 'openai' && !openAIKey) {
  console.error('OPENAI_API_KEY is required for openai provider.')
  process.exit(1)
}

const DIM = 1024
const BATCH = 16
const limit = parseInt((process.argv.find((arg) => arg.startsWith('--limit=')) || '').split('=')[1] || '0', 10)

async function embed(texts) {
  if (provider === 'ollama') {
    const res = await fetch(`${ollamaUrl}/api/embed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: embeddingModel, input: texts })
    })
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`)
    const data = await res.json()
    return (data.embeddings || []).map((v) => normalize(v))
  }
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${openAIKey}` },
    body: JSON.stringify({ model: embeddingModel, input: texts, dimensions: DIM, encoding_format: 'float' })
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const ordered = new Array(texts.length).fill(null)
  for (const row of data.data) ordered[row.index] = normalize(row.embedding)
  return ordered
}

function normalize(vec) {
  if (!Array.isArray(vec)) return null
  if (vec.length === DIM) return vec
  if (vec.length > DIM) return vec.slice(0, DIM)
  const padded = vec.slice()
  while (padded.length < DIM) padded.push(0)
  return padded
}

const pgClient = new pg.Client({ connectionString: databaseUrl })
await pgClient.connect()

async function backfillEntities() {
  const rows = await pgClient.query(
    `SELECT id, type, name, metadata FROM entities WHERE embedding IS NULL${limit ? ` LIMIT ${limit}` : ''}`
  )
  console.log(`Entities to embed: ${rows.rows.length}`)
  for (let i = 0; i < rows.rows.length; i += BATCH) {
    const batch = rows.rows.slice(i, i + BATCH)
    const texts = batch.map((r) => {
      const desc = r.metadata?.description ? `\n${r.metadata.description}` : ''
      return `${r.type}: ${r.name}${desc}`
    })
    const vectors = await embed(texts)
    for (let j = 0; j < batch.length; j++) {
      const v = vectors[j]
      if (!v) continue
      await pgClient.query(
        `UPDATE entities SET embedding = $1::vector, embedding_source = $2, embedding_updated_at = now() WHERE id = $3`,
        [`[${v.join(',')}]`, `${provider}:${embeddingModel}`, batch[j].id]
      )
    }
    process.stdout.write(`.`)
  }
  process.stdout.write('\n')
}

async function backfillChunks() {
  const rows = await pgClient.query(
    `SELECT id, content FROM chunks WHERE embedding IS NULL${limit ? ` LIMIT ${limit}` : ''}`
  )
  console.log(`Chunks to embed: ${rows.rows.length}`)
  for (let i = 0; i < rows.rows.length; i += BATCH) {
    const batch = rows.rows.slice(i, i + BATCH)
    const vectors = await embed(batch.map((r) => r.content))
    for (let j = 0; j < batch.length; j++) {
      const v = vectors[j]
      if (!v) continue
      await pgClient.query(
        `UPDATE chunks SET embedding = $1::vector WHERE id = $2`,
        [`[${v.join(',')}]`, batch[j].id]
      )
    }
    process.stdout.write(`.`)
  }
  process.stdout.write('\n')
}

try {
  await backfillEntities()
  await backfillChunks()
  console.log('Backfill complete.')
} finally {
  await pgClient.end()
}
