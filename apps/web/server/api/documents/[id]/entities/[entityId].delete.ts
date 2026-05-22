import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../../utils/auth'
import { withTransaction } from '../../../../utils/db'

/**
 * Detach an entity from one document. Removes the entity_mentions
 * row(s) and the matching knowledge_edges for this (doc, entity) pair.
 *
 * The entity itself is NEVER deleted - it stays available for other
 * documents and global rename / merge. Hard-delete of an entity is a
 * different operation (PATCH/DELETE on /api/people|projects|tags/:id).
 *
 * Idempotent: detaching an entity that was already detached returns
 * 200 with detached=false rather than 404, so the UI can retry
 * without surprises.
 *
 * Cookie auth only.
 */
export default defineEventHandler(async (event) => {
  requireAuth(event)
  const documentId = getRouterParam(event, 'id')
  const entityId = getRouterParam(event, 'entityId')
  if (!documentId || !entityId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }

  return withTransaction(async (client) => {
    const docCheck = await client.query<{ id: string }>(
      `SELECT id FROM documents WHERE id = $1 AND deleted_at IS NULL`,
      [documentId]
    )
    if (!docCheck.rowCount) throw createError({ statusCode: 404, statusMessage: 'Document not found' })

    // Only people / projects / tags are user-attachable. Refuse to detach
    // structural entities (decisions, insights, questions, actions) -
    // those are owned by their own tables and the document detail
    // already exposes per-row delete controls for them.
    const entityRow = await client.query<{ type: string }>(
      `SELECT type FROM entities WHERE id = $1 AND deleted_at IS NULL`,
      [entityId]
    )
    if (entityRow.rowCount && !['person', 'project', 'tag'].includes(entityRow.rows[0]!.type)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Cannot detach entity of type "${entityRow.rows[0]!.type}" - use the matching per-type endpoint instead`
      })
    }

    const mentions = await client.query(
      `DELETE FROM entity_mentions
       WHERE document_id = $1 AND entity_id = $2`,
      [documentId, entityId]
    )

    await client.query(
      `DELETE FROM knowledge_edges
       WHERE document_id = $1
         AND relation_type = 'document_mentions'
         AND (source_entity_id = $2 OR target_entity_id = $2)`,
      [documentId, entityId]
    )

    return { detached: (mentions.rowCount || 0) > 0 }
  })
})
