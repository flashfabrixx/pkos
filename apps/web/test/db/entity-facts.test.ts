import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestPg, withTx, type TestPgContext } from '../setup/pg'
import { loadFactsForEntityIds, renderFactsBlock } from '../../server/utils/entity-facts'

describe('entity_facts (migration 0023)', () => {
  let ctx: TestPgContext

  beforeAll(async () => {
    ctx = await startTestPg()
  }, 120_000)

  afterAll(async () => {
    await ctx?.stop()
  })

  it('cascades deletes when the parent entity is removed', async () => {
    await withTx(ctx, async (client) => {
      const entity = await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name)
         VALUES ('person', 'Cascade', 'cascade') RETURNING id`
      )
      const eid = entity.rows[0]!.id
      await client.query(
        `INSERT INTO entity_facts (entity_id, body, position) VALUES ($1, 'a', 0), ($1, 'b', 1)`,
        [eid]
      )
      await client.query(`DELETE FROM entities WHERE id = $1`, [eid])
      const count = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM entity_facts WHERE entity_id = $1`,
        [eid]
      )
      expect(count.rows[0]!.n).toBe('0')
    })
  })

  it('rejects empty bodies', async () => {
    await withTx(ctx, async (client) => {
      const entity = await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name)
         VALUES ('project', 'Empty', 'empty') RETURNING id`
      )
      await expect(
        client.query(
          `INSERT INTO entity_facts (entity_id, body) VALUES ($1, '   ')`,
          [entity.rows[0]!.id]
        )
      ).rejects.toThrow()
    })
  })

  it('loadFactsForEntityIds groups facts by entity and orders by position', async () => {
    await withTx(ctx, async (client) => {
      const a = (await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name) VALUES ('person', 'Alpha', 'alpha') RETURNING id`
      )).rows[0]!.id
      const b = (await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name) VALUES ('person', 'Beta', 'beta') RETURNING id`
      )).rows[0]!.id

      await client.query(
        `INSERT INTO entity_facts (entity_id, body, position)
         VALUES ($1, 'first', 0), ($1, 'second', 1), ($2, 'sole', 0)`,
        [a, b]
      )

      const grouped = await loadFactsForEntityIds(client, [a, b])
      expect(grouped.get(a)?.map((f) => f.body)).toEqual(['first', 'second'])
      expect(grouped.get(b)?.map((f) => f.body)).toEqual(['sole'])
    })
  })

  it('renderFactsBlock formats facts as a bullet list with a header', () => {
    const block = renderFactsBlock('Anna Mueller', [
      { id: '1', entity_id: 'x', body: 'Prefers async followups', position: 0, created_at: '', updated_at: '' },
      { id: '2', entity_id: 'x', body: 'Owns the embeddings pipeline', position: 1, created_at: '', updated_at: '' }
    ])
    expect(block).toBe(
      'Facts to remember about Anna Mueller:\n- Prefers async followups\n- Owns the embeddings pipeline'
    )
  })

  it('renderFactsBlock returns null for an empty list', () => {
    expect(renderFactsBlock('Anyone', [])).toBeNull()
  })
})
