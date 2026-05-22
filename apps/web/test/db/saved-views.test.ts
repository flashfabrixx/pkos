import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestPg, withTx, type TestPgContext } from '../setup/pg'

describe('saved_views (migration 0024)', () => {
  let ctx: TestPgContext

  beforeAll(async () => {
    ctx = await startTestPg()
  }, 120_000)

  afterAll(async () => {
    await ctx?.stop()
  })

  it('persists name + query + filters JSON and round-trips them', async () => {
    await withTx(ctx, async (client) => {
      const r = await client.query<{ id: string, name: string, q: string, filters: any }>(
        `INSERT INTO saved_views (name, q, filters)
         VALUES ('Anna recent', 'anna mueller', $1::jsonb)
         RETURNING id, name, q, filters`,
        [JSON.stringify({ kinds: ['reflection'], lang: 'en', limit: 20 })]
      )
      const row = r.rows[0]!
      expect(row.name).toBe('Anna recent')
      expect(row.q).toBe('anna mueller')
      expect(row.filters.kinds).toEqual(['reflection'])
      expect(row.filters.lang).toBe('en')
      expect(row.filters.limit).toBe(20)
    })
  })

  it('rejects empty names', async () => {
    await withTx(ctx, async (client) => {
      await expect(
        client.query(`INSERT INTO saved_views (name) VALUES ('   ')`)
      ).rejects.toThrow()
    })
  })

  it('soft-delete sets deleted_at without removing the row', async () => {
    await withTx(ctx, async (client) => {
      const r = await client.query<{ id: string }>(
        `INSERT INTO saved_views (name) VALUES ('Doomed') RETURNING id`
      )
      const id = r.rows[0]!.id
      await client.query(
        `UPDATE saved_views SET deleted_at = now() WHERE id = $1`,
        [id]
      )
      const still = await client.query(`SELECT id, deleted_at FROM saved_views WHERE id = $1`, [id])
      expect(still.rowCount).toBe(1)
      expect(still.rows[0]!.deleted_at).not.toBeNull()
    })
  })
})
