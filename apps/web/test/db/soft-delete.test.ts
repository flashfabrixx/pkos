import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestPg, withTx, type TestPgContext } from '../setup/pg'

describe('soft-delete schema (migration 0013)', () => {
  let ctx: TestPgContext

  beforeAll(async () => {
    ctx = await startTestPg()
  })

  afterAll(async () => {
    await ctx?.stop()
  })

  it('adds deleted_at columns to documents, entities, action_items, comments', async () => {
    const result = await ctx.pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = 'deleted_at'
          AND table_name IN ('documents', 'entities', 'action_items', 'comments')
        ORDER BY table_name`
    )
    expect(result.rows.map((row) => row.table_name)).toEqual([
      'action_items',
      'comments',
      'documents',
      'entities'
    ])
  })

  it('hides soft-deleted documents from the live listing query', async () => {
    await withTx(ctx, async (client) => {
      await client.query(
        `INSERT INTO documents (id, title, source_type, raw_text) VALUES
           ('11111111-1111-1111-1111-111111111111', 'live', 'other', 'live body that is long enough'),
           ('22222222-2222-2222-2222-222222222222', 'trashed', 'other', 'trashed body that is long enough')`
      )
      await client.query(`UPDATE documents SET deleted_at = now() WHERE id = '22222222-2222-2222-2222-222222222222'`)

      const live = await client.query('SELECT id FROM documents WHERE deleted_at IS NULL ORDER BY title')
      expect(live.rows.map((r) => r.id)).toEqual(['11111111-1111-1111-1111-111111111111'])

      const trashed = await client.query('SELECT id FROM documents WHERE deleted_at IS NOT NULL')
      expect(trashed.rows.map((r) => r.id)).toEqual(['22222222-2222-2222-2222-222222222222'])
    })
  })

  it('restores by clearing deleted_at', async () => {
    await withTx(ctx, async (client) => {
      await client.query(
        `INSERT INTO documents (id, title, source_type, raw_text, deleted_at)
         VALUES ('33333333-3333-3333-3333-333333333333', 'restore-me', 'other', 'restore body that is long enough', now())`
      )
      await client.query(`UPDATE documents SET deleted_at = NULL WHERE id = '33333333-3333-3333-3333-333333333333'`)
      const r = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM documents WHERE id = '33333333-3333-3333-3333-333333333333' AND deleted_at IS NULL`
      )
      expect(r.rows[0]?.count).toBe('1')
    })
  })
})
