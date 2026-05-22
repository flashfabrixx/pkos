import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestPg, withTx, type TestPgContext } from '../setup/pg'
import { compileEntityExport } from '../../server/utils/entity-export'

describe('compileEntityExport', () => {
  let ctx: TestPgContext

  beforeAll(async () => {
    ctx = await startTestPg()
  }, 120_000)

  afterAll(async () => {
    await ctx?.stop()
  })

  it('renders a structured Markdown briefing for a person with captures, actions, decisions and questions', async () => {
    await withTx(ctx, async (client) => {
      // Seed a person plus two documents that mention her.
      const personId = (await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name, metadata)
         VALUES ('person', 'Anna Mueller', 'anna mueller', '{"description":"Lead architect"}'::jsonb)
         RETURNING id`
      )).rows[0]!.id

      const docOldId = (await client.query<{ id: string }>(
        `INSERT INTO documents (title, source_type, raw_text, status, captured_at, summary)
         VALUES ('Pricing kickoff', 'meeting', 'transcript ...', 'processed', '2026-05-10', 'Aligned on the pricing model with Anna.')
         RETURNING id`
      )).rows[0]!.id
      const docNewId = (await client.query<{ id: string }>(
        `INSERT INTO documents (title, source_type, raw_text, status, captured_at, summary)
         VALUES ('Pricing followup', 'voice_note', 'transcript ...', 'processed', '2026-05-20', 'Anna wants the deck by Friday.')
         RETURNING id`
      )).rows[0]!.id
      // unrelated document - must not appear in the export.
      const unrelatedId = (await client.query<{ id: string }>(
        `INSERT INTO documents (title, source_type, raw_text, status, captured_at, summary)
         VALUES ('Unrelated all-hands', 'meeting', 'transcript ...', 'processed', '2026-05-15', 'About something else entirely.')
         RETURNING id`
      )).rows[0]!.id

      for (const docId of [docOldId, docNewId]) {
        await client.query(
          `INSERT INTO entity_mentions (entity_id, document_id) VALUES ($1, $2)`,
          [personId, docId]
        )
      }

      // Two action items: one assigned directly to Anna (open, with due date)
      // and one in her document but unassigned (done).
      await client.query(
        `INSERT INTO action_items (title, status, due_date, document_id, person_id)
         VALUES ('Send pricing deck to Anna', 'open', '2026-05-25', $1, $2)`,
        [docNewId, personId]
      )
      await client.query(
        `INSERT INTO action_items (title, status, document_id)
         VALUES ('Schedule the pricing reviewers', 'open', $1)`,
        [docOldId]
      )
      await client.query(
        `INSERT INTO action_items (title, status, document_id, person_id)
         VALUES ('Old action that is done', 'done', $1, $2)`,
        [docOldId, personId]
      )

      // A decision + insight + open question
      await client.query(
        `INSERT INTO decisions (title, document_id, rationale)
         VALUES ('Ship pricing v2 in June', $1, 'Aligned with Anna; market window is open.')`,
        [docOldId]
      )
      await client.query(
        `INSERT INTO insights (title, document_id)
         VALUES ('Pricing maturity correlates with customer tier', $1)`,
        [docNewId]
      )
      await client.query(
        `INSERT INTO open_questions (title, status, document_id)
         VALUES ('Should the high tier include onsite training?', 'open', $1)`,
        [docNewId]
      )

      // A related person (Peter) mentioned in the same older document
      const peterId = (await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name) VALUES ('person', 'Peter Schmidt', 'peter schmidt') RETURNING id`
      )).rows[0]!.id
      await client.query(
        `INSERT INTO entity_mentions (entity_id, document_id) VALUES ($1, $2)`,
        [peterId, docOldId]
      )

      // Entity-level comment on Anna
      await client.query(
        `INSERT INTO comments (entity_id, body) VALUES ($1, 'Prefers async followups')`,
        [personId]
      )

      // Unrelated mentions on the unrelated doc - must not surface.
      const otherId = (await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name) VALUES ('person', 'Other Person', 'other person') RETURNING id`
      )).rows[0]!.id
      await client.query(`INSERT INTO entity_mentions (entity_id, document_id) VALUES ($1, $2)`, [otherId, unrelatedId])

      const md = await compileEntityExport(client, personId)

      // Header + meta
      expect(md).toContain('# Person: Anna Mueller')
      expect(md).toContain('First seen: 2026-05-10')
      expect(md).toContain('Last seen: 2026-05-20')
      expect(md).toContain('Documents: 2')
      expect(md).toMatch(/Action items:\s*1 open \/ 1 done/)
      expect(md).toContain('Lead architect')

      // Captures section, newest first
      const idxOld = md.indexOf('Pricing kickoff')
      const idxNew = md.indexOf('Pricing followup')
      expect(idxNew).toBeGreaterThan(-1)
      expect(idxOld).toBeGreaterThan(-1)
      expect(idxNew).toBeLessThan(idxOld) // newest before older

      // The unrelated document must NOT be in the export
      expect(md).not.toContain('Unrelated all-hands')

      // Open action with due date is listed
      expect(md).toMatch(/\*\*2026-05-25\*\* — Send pricing deck to Anna/)
      // Contextual (unassigned) open action also shows but tagged with origin
      expect(md).toContain('Schedule the pricing reviewers')
      expect(md).toContain('_(from Pricing kickoff)_')
      // Done action lives under "Closed action items"
      expect(md).toContain('Closed action items')
      expect(md).toContain('Old action that is done')

      // Decision + insight + open question surfaced
      expect(md).toContain('Ship pricing v2 in June')
      expect(md).toContain('Aligned with Anna') // rationale rendered
      expect(md).toContain('Pricing maturity correlates with customer tier')
      expect(md).toContain('Should the high tier include onsite training?')

      // Related entities (Peter co-mentioned once)
      expect(md).toContain('Related entities')
      expect(md).toContain('Peter Schmidt (1)')
      // Other person (not in Anna's docs) must NOT appear
      expect(md).not.toContain('Other Person')

      // Entity-level comment
      expect(md).toContain('Prefers async followups')

      // Footer
      expect(md).toMatch(/_Exported from PKOS on \d{4}-\d{2}-\d{2}\._/)
    })
  })

  it('renders a project export with co-mentioned tags', async () => {
    await withTx(ctx, async (client) => {
      const projectId = (await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name)
         VALUES ('project', 'IT-OT Alignment', 'it-ot alignment')
         RETURNING id`
      )).rows[0]!.id
      const tagId = (await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name)
         VALUES ('tag', 'ot-security', 'ot-security')
         RETURNING id`
      )).rows[0]!.id

      const docId = (await client.query<{ id: string }>(
        `INSERT INTO documents (title, source_type, raw_text, status, captured_at, summary)
         VALUES ('OT security workshop', 'meeting', 'transcript ...', 'processed', '2026-05-18', 'OT security topics aligned.')
         RETURNING id`
      )).rows[0]!.id

      await client.query(`INSERT INTO entity_mentions (entity_id, document_id) VALUES ($1, $2)`, [projectId, docId])
      await client.query(`INSERT INTO entity_mentions (entity_id, document_id) VALUES ($1, $2)`, [tagId, docId])

      // Contextual action (no person_id) - for a project export it
      // should still appear.
      await client.query(
        `INSERT INTO action_items (title, status, document_id)
         VALUES ('Finalize SOC scope', 'open', $1)`,
        [docId]
      )

      const md = await compileEntityExport(client, projectId)
      expect(md).toContain('# Project: IT-OT Alignment')
      expect(md).toContain('OT security workshop')
      expect(md).toContain('Finalize SOC scope')
      expect(md).toContain('#ot-security (1)')
    })
  })

  it('renders a tag export and handles entities with zero captures', async () => {
    await withTx(ctx, async (client) => {
      const tagId = (await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name)
         VALUES ('tag', 'embeddings', 'embeddings')
         RETURNING id`
      )).rows[0]!.id

      const md = await compileEntityExport(client, tagId)
      expect(md).toContain('# Tag: #embeddings')
      expect(md).toContain('Documents: 0')
      // No "Recent captures" section when there is nothing
      expect(md).not.toContain('## Recent captures')
      // Footer always present
      expect(md).toMatch(/_Exported from PKOS on/)
    })
  })

  it('throws on a non-existent entity and on an unsupported type', async () => {
    await withTx(ctx, async (client) => {
      await expect(compileEntityExport(client, '00000000-0000-0000-0000-000000000000')).rejects.toThrow(/not found/)

      const decisionId = (await client.query<{ id: string }>(
        `INSERT INTO entities (type, name, canonical_name)
         VALUES ('decision', 'A decision', 'a decision') RETURNING id`
      )).rows[0]!.id
      await expect(compileEntityExport(client, decisionId)).rejects.toThrow(/unsupported type/)
    })
  })
})
