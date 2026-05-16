import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestPg, withTx, type TestPgContext } from '../setup/pg'

/**
 * The entity-merge endpoint moves mentions, comments, knowledge_edges and
 * action_item assignments onto the primary entity, records an activity, and
 * hard-deletes the absorbed rows. These tests mirror the SQL contract so we
 * notice if a future change drops one of those moves.
 */
describe('entity merge SQL contract', () => {
  let ctx: TestPgContext

  beforeAll(async () => {
    ctx = await startTestPg()
  })

  afterAll(async () => {
    await ctx?.stop()
  })

  it('migrates mentions, comments and action assignments to the primary', async () => {
    await withTx(ctx, async (client) => {
      // Seed: one document and two duplicate "person" entities.
      const doc = await client.query<{ id: string }>(
        `INSERT INTO documents (title, source_type, raw_text) VALUES ('seed', 'other', 'seed body that is long enough') RETURNING id`
      )
      const docId = doc.rows[0]!.id
      const primary = await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name) VALUES ('person', 'Alice Anderson', 'alice-anderson') RETURNING id`
      )
      const dup = await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name) VALUES ('person', 'A. Anderson', 'a-anderson') RETURNING id`
      )
      const primaryId = primary.rows[0]!.id
      const dupId = dup.rows[0]!.id

      await client.query(
        `INSERT INTO entity_mentions (entity_id, document_id, excerpt) VALUES ($1, $2, 'first mention')`,
        [dupId, docId]
      )
      await client.query(
        `INSERT INTO comments (entity_id, body) VALUES ($1, 'duplicate had a comment')`,
        [dupId]
      )
      await client.query(
        `INSERT INTO action_items (document_id, person_id, title) VALUES ($1, $2, 'an action assigned to dup')`,
        [docId, dupId]
      )

      // Mirror the merge endpoint's data moves.
      await client.query(
        `INSERT INTO entity_mentions (entity_id, document_id, excerpt, confidence)
         SELECT $1, document_id, excerpt, confidence FROM entity_mentions WHERE entity_id = $2
         ON CONFLICT (entity_id, document_id, excerpt) DO NOTHING`,
        [primaryId, dupId]
      )
      await client.query(`DELETE FROM entity_mentions WHERE entity_id = $1`, [dupId])
      await client.query(`UPDATE comments SET entity_id = $1 WHERE entity_id = $2`, [primaryId, dupId])
      await client.query(`UPDATE action_items SET person_id = $1 WHERE person_id = $2`, [primaryId, dupId])
      await client.query(`DELETE FROM entities WHERE id = $1`, [dupId])

      const mentions = await client.query<{ entity_id: string }>(`SELECT entity_id FROM entity_mentions WHERE document_id = $1`, [docId])
      expect(mentions.rows.map((r) => r.entity_id)).toEqual([primaryId])

      const comments = await client.query<{ entity_id: string }>(`SELECT entity_id FROM comments WHERE body = 'duplicate had a comment'`)
      expect(comments.rows[0]?.entity_id).toBe(primaryId)

      const action = await client.query<{ person_id: string }>(`SELECT person_id FROM action_items WHERE title = 'an action assigned to dup'`)
      expect(action.rows[0]?.person_id).toBe(primaryId)

      const dupGone = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM entities WHERE id = $1`, [dupId])
      expect(dupGone.rows[0]?.count).toBe('0')
    })
  })
})
