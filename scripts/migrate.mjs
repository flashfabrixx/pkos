import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import pg from 'pg'

const databaseUrl = process.env.DATABASE_URL || 'postgres://bkos:bkos@localhost:5433/bkos'
const migrationsDir = new URL('../infra/migrations', import.meta.url)
const client = new pg.Client({ connectionString: databaseUrl })

await client.connect()
await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`)

const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort()

for (const file of files) {
  const seen = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file])
  if (seen.rowCount) {
    console.log(`skip ${file}`)
    continue
  }

  const sql = await readFile(join(migrationsDir.pathname, file), 'utf8')
  await client.query('BEGIN')
  try {
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
    await client.query('COMMIT')
    console.log(`applied ${file}`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

await client.end()
