import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestPg, withTx, type TestPgContext } from '../setup/pg'
import { emitEntityMatchReview, findFuzzyMatch } from '../../server/utils/capture-reviews'

describe('capture_reviews (migration 0026)', () => {
  let ctx: TestPgContext

  beforeAll(async () => {
    ctx = await startTestPg()
  }, 120_000)

  afterAll(async () => {
    await ctx?.stop()
  })

  it('cascades when the parent document is deleted', async () => {
    await withTx(ctx, async (client) => {
      const doc = await client.query<{ id: string }>(
        `INSERT INTO documents (title, source_type, raw_text, status, language, confidentiality)
         VALUES ('t', 'reflection', '', 'processed', 'en', 'private') RETURNING id`
      )
      const did = doc.rows[0]!.id
      await client.query(
        `INSERT INTO capture_reviews (document_id, kind) VALUES ($1, 'entity_match')`,
        [did]
      )
      await client.query(`DELETE FROM documents WHERE id = $1`, [did])
      const remaining = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM capture_reviews WHERE document_id = $1`,
        [did]
      )
      expect(remaining.rows[0]!.n).toBe('0')
    })
  })

  it('findFuzzyMatch returns nearby canonical names within the unsure range', async () => {
    await withTx(ctx, async (client) => {
      await client.query(
        `INSERT INTO entities (type, name, canonical_name) VALUES ('person', 'Anna Mueller', 'anna-mueller')`
      )
      // "anna" (4 chars) vs "anna-mueller" — trigram sim should land
      // in the unsure window.
      const m = await findFuzzyMatch(client, 'person', 'anna')
      expect(m).toBeTruthy()
      expect(m?.canonical_name).toBe('anna-mueller')
      expect(m?.similarity).toBeGreaterThanOrEqual(0.4)
      expect(m?.similarity).toBeLessThan(0.85)
    })
  })

  it('findFuzzyMatch returns null when nothing is close enough', async () => {
    await withTx(ctx, async (client) => {
      await client.query(
        `INSERT INTO entities (type, name, canonical_name) VALUES ('person', 'Tom Cook', 'tom-cook')`
      )
      const m = await findFuzzyMatch(client, 'person', 'completely-different-name')
      expect(m).toBeNull()
    })
  })

  it('emitEntityMatchReview is idempotent for the same (new, candidate) pair', async () => {
    await withTx(ctx, async (client) => {
      const doc = await client.query<{ id: string }>(
        `INSERT INTO documents (title, source_type, raw_text, status, language, confidentiality)
         VALUES ('t2', 'reflection', '', 'processed', 'en', 'private') RETURNING id`
      )
      const did = doc.rows[0]!.id
      const a = await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name) VALUES ('person', 'A', 'a') RETURNING id`
      )
      const b = await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name) VALUES ('person', 'B', 'b') RETURNING id`
      )
      const params = {
        documentId: did,
        newEntity: { id: a.rows[0]!.id, name: 'A', type: 'person' as const },
        candidate: { id: b.rows[0]!.id, name: 'B', canonical_name: 'b', similarity: 0.6 }
      }
      await emitEntityMatchReview(client, params)
      await emitEntityMatchReview(client, params)
      const r = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM capture_reviews WHERE document_id = $1`,
        [did]
      )
      expect(r.rows[0]!.n).toBe('1')
    })
  })
})
