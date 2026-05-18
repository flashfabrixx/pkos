import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import pg from 'pg'

const here = fileURLToPath(new URL('.', import.meta.url))
const migrationsDir = join(here, '..', '..', '..', '..', 'infra', 'migrations')

/**
 * Lifecycle wrapper for a Postgres testcontainer with the PKOS schema
 * applied. Each suite that needs a real database should call
 * `await startTestPg()` in `beforeAll` and `await ctx.stop()` in
 * `afterAll`. The schema is applied once; individual tests use
 * `withTx(ctx, fn)` to run inside a transaction that gets rolled back so
 * cases stay independent.
 */
export interface TestPgContext {
  container: StartedPostgreSqlContainer
  pool: pg.Pool
  connectionString: string
  stop: () => Promise<void>
}

export async function startTestPg(): Promise<TestPgContext> {
  const container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
    .withDatabase('pkos_test')
    .withUsername('pkos')
    .withPassword('pkos')
    .start()
  const connectionString = container.getConnectionUri()
  const pool = new pg.Pool({ connectionString, max: 4 })

  await applyMigrations(pool)

  return {
    container,
    pool,
    connectionString,
    async stop() {
      await pool.end()
      await container.stop()
    }
  }
}

async function applyMigrations(pool: pg.Pool) {
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort()
  const client = await pool.connect()
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`)
    for (const file of files) {
      const sql = await readFile(join(migrationsDir, file), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [file])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`)
      }
    }
  } finally {
    client.release()
  }
}

/**
 * Run a test function inside a savepoint-rolled-back transaction. Used so
 * test cases never leak rows into each other while still sharing the
 * (expensive) container + schema.
 */
export async function withTx<T>(ctx: TestPgContext, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await ctx.pool.connect()
  try {
    await client.query('BEGIN')
    try {
      const result = await fn(client)
      return result
    } finally {
      await client.query('ROLLBACK')
    }
  } finally {
    client.release()
  }
}
