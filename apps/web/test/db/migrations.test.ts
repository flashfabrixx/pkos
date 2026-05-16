import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestPg, type TestPgContext } from '../setup/pg'

/**
 * Migration runner smoke. If this fails the entire test infra is broken,
 * so it lives near the top of the suite to surface fast.
 */
describe('migration suite', () => {
  let ctx: TestPgContext

  beforeAll(async () => {
    ctx = await startTestPg()
  })

  afterAll(async () => {
    await ctx?.stop()
  })

  it('applies every migration in infra/migrations', async () => {
    const applied = await ctx.pool.query<{ filename: string }>(
      `SELECT filename FROM schema_migrations ORDER BY filename`
    )
    expect(applied.rows.length).toBeGreaterThan(0)
    expect(applied.rows[0]?.filename).toBe('0001_init.sql')
  })

  it('installs pgvector', async () => {
    const r = await ctx.pool.query<{ extname: string }>(
      `SELECT extname FROM pg_extension WHERE extname = 'vector'`
    )
    expect(r.rows[0]?.extname).toBe('vector')
  })

  it('keeps the entities + documents core tables present', async () => {
    const r = await ctx.pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('documents', 'entities', 'action_items', 'comments', 'chunks')
        ORDER BY table_name`
    )
    expect(r.rows.map((row) => row.table_name)).toEqual([
      'action_items',
      'chunks',
      'comments',
      'documents',
      'entities'
    ])
  })
})
