import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestPg, withTx, type TestPgContext } from '../setup/pg'

describe('entity_link_suggestions (migration 0017)', () => {
  let ctx: TestPgContext

  beforeAll(async () => {
    ctx = await startTestPg()
  })

  afterAll(async () => {
    await ctx?.stop()
  })

  it('rejects self-suggestions and duplicates of (source, target, reason)', async () => {
    await withTx(ctx, async (client) => {
      const a = await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name) VALUES ('person', 'A', 'a') RETURNING id`
      )
      const b = await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name) VALUES ('person', 'B', 'b') RETURNING id`
      )
      const aid = a.rows[0]!.id
      const bid = b.rows[0]!.id

      // A failed statement aborts the outer transaction, so wrap each
      // expected-to-fail insert in a SAVEPOINT we can roll back.
      await client.query('SAVEPOINT sp_self')
      await expect(
        client.query(
          `INSERT INTO entity_link_suggestions (source_id, target_id, score) VALUES ($1, $1, 0.9)`,
          [aid]
        )
      ).rejects.toThrow()
      await client.query('ROLLBACK TO SAVEPOINT sp_self')

      await client.query(
        `INSERT INTO entity_link_suggestions (source_id, target_id, score) VALUES ($1, $2, 0.9)`,
        [aid, bid]
      )

      await client.query('SAVEPOINT sp_dup')
      await expect(
        client.query(
          `INSERT INTO entity_link_suggestions (source_id, target_id, score) VALUES ($1, $2, 0.95)`,
          [aid, bid]
        )
      ).rejects.toThrow()
      await client.query('ROLLBACK TO SAVEPOINT sp_dup')
    })
  })
})
