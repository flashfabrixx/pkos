import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../../utils/auth'
import { withTransaction } from '../../../../utils/db'
import { addEdge, addMention, upsertEntity } from '../../../../utils/graph'

/**
 * Attach a person / project / tag to a document. Either pass an
 * existing `entityId`, or pass a `{type, name}` pair to find-or-create
 * the entity and link it.
 *
 * Idempotent: re-posting the same pair does not create duplicate
 * mention rows (entity_mentions enforces UNIQUE on (entity_id,
 * document_id, excerpt) and addMention uses ON CONFLICT DO NOTHING).
 *
 * Cookie auth only - matches the rest of the internal document
 * detail API. External clients should keep using the v1 surface.
 */
const schema = z.union([
  z.object({
    entityId: z.string().uuid()
  }),
  z.object({
    type: z.enum(['person', 'project', 'tag']),
    name: z.string().trim().min(1).max(200)
  })
])

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const documentId = getRouterParam(event, 'id')
  if (!documentId) throw createError({ statusCode: 400, statusMessage: 'Missing document id' })
  const body = schema.parse(await readBody(event))

  return withTransaction(async (client) => {
    // Make sure the document exists and isn't soft-deleted - otherwise
    // we'd cheerfully attach to a tombstone.
    const docCheck = await client.query<{ id: string }>(
      `SELECT id FROM documents WHERE id = $1 AND deleted_at IS NULL`,
      [documentId]
    )
    if (!docCheck.rowCount) throw createError({ statusCode: 404, statusMessage: 'Document not found' })

    // Resolve to a target entity.
    let entity: { id: string, type: string, name: string }
    if ('entityId' in body) {
      const result = await client.query<{ id: string, type: string, name: string }>(
        `SELECT id, type, name FROM entities WHERE id = $1 AND deleted_at IS NULL`,
        [body.entityId]
      )
      if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: 'Entity not found' })
      const row = result.rows[0]!
      if (!['person', 'project', 'tag'].includes(row.type)) {
        throw createError({ statusCode: 400, statusMessage: `Cannot attach entity of type "${row.type}"` })
      }
      entity = row
    } else {
      const ref = await upsertEntity(client, body.type, body.name)
      entity = { id: ref.id, type: ref.type, name: ref.name }
    }

    await addMention(client, entity.id, documentId, null)

    // Keep parity with the extractor pipeline: every mention also gets a
    // document_mentions edge from the document's own entity (if it
    // exists - the extractor creates one per document, but manual
    // captures from /api/v1 don't always have one).
    const docEntity = await client.query<{ id: string }>(
      `SELECT id FROM entities
       WHERE type = 'document' AND (metadata->>'document_id')::uuid = $1
       LIMIT 1`,
      [documentId]
    )
    if (docEntity.rowCount) {
      await addEdge(client, docEntity.rows[0]!.id, entity.id, 'document_mentions', documentId, null, 0.9)
    }

    return { entity: { id: entity.id, type: entity.type, name: entity.name } }
  })
})
