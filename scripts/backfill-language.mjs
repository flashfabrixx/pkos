#!/usr/bin/env node
// Detect a language for every document that has none yet, and re-index its
// chunks with the matching Postgres TSV config.

import pg from 'pg'
import { readFileSync, existsSync } from 'node:fs'
import { franc } from 'franc-min'

const envPath = '.env'
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL required.')
  process.exit(1)
}

const ISO3_TO_ISO1 = {
  eng: 'en', deu: 'de', fra: 'fr', spa: 'es', ita: 'it', nld: 'nl',
  por: 'pt', rus: 'ru', swe: 'sv', dan: 'da', fin: 'fi', nor: 'no',
  hun: 'hu', ron: 'ro', tur: 'tr'
}
const ISO1_TO_PG = {
  en: 'english', de: 'german', fr: 'french', es: 'spanish', it: 'italian',
  nl: 'dutch', pt: 'portuguese', ru: 'russian', sv: 'swedish', da: 'danish',
  fi: 'finnish', no: 'norwegian', hu: 'hungarian', ro: 'romanian', tr: 'turkish'
}

const client = new pg.Client({ connectionString: databaseUrl })
await client.connect()

try {
  const docs = await client.query(
    `SELECT id, title, raw_text, summary FROM documents WHERE language IS NULL`
  )
  console.log(`Documents needing language detection: ${docs.rows.length}`)

  for (const doc of docs.rows) {
    const sample = `${doc.title || ''}\n\n${doc.raw_text || ''}\n\n${doc.summary || ''}`.trim()
    if (sample.length < 24) continue
    const iso3 = franc(sample, { minLength: 24 })
    const iso1 = ISO3_TO_ISO1[iso3] || null
    const pgConfig = iso1 ? (ISO1_TO_PG[iso1] || 'simple') : 'simple'
    await client.query(
      `UPDATE documents SET language = $1,
        metadata = metadata || jsonb_build_object('language_pg_config', $2::text),
        updated_at = now()
       WHERE id = $3`,
      [iso1, pgConfig, doc.id]
    )
    // Re-index chunks with the right config.
    await client.query(
      `UPDATE chunks SET search_vector = to_tsvector($1::regconfig, content) WHERE document_id = $2`,
      [pgConfig, doc.id]
    )
    console.log(`  ${doc.id.slice(0, 8)} → ${iso1 || 'simple'}`)
  }
  console.log('Language backfill complete.')
} finally {
  await client.end()
}
