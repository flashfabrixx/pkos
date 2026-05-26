import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import { query, withTransaction } from '../../../utils/db'

/**
 * Resolve a capture review.
 *
 * For entity_match reviews:
 *   - confirm  → merges the newly-extracted entity into the candidate
 *                (uses the same merge primitives as the People/Tags
 *                merge dialog). Resolution: { action: 'merged', kept }
 *   - reject   → keeps both entities separate. Resolution: { action: 'kept_separate' }
 *   - skip     → marks the review as dismissed. Won't re-fire for the
 *                same (new, candidate) pair on the same document.
 *
 * Returns the final review row.
 */

const schema = z.object({
  action: z.enum(['confirm', 'reject', 'skip'])
})

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.message })
  const { action } = parsed.data

  return withTransaction(async (client) => {
    const r = await client.query<{
      id: string, document_id: string, kind: string,
      payload: Record<string, any>, suggestion: Record<string, any>, status: string
    }>(
      `SELECT id, document_id, kind, payload, suggestion, status
         FROM capture_reviews WHERE id = $1 FOR UPDATE`,
      [id]
    )
    const review = r.rows[0]
    if (!review) throw createError({ statusCode: 404, statusMessage: 'Review not found' })
    if (review.status !== 'open') throw createError({ statusCode: 409, statusMessage: 'Review already resolved' })

    let resolution: Record<string, unknown> = { action }

    if (review.kind === 'entity_match' && action === 'confirm') {
      // Merge: the extracted entity (newEntityId) folds into the
      // candidate. Move mentions, remap action_items, delete the new
      // entity. Same shape as the existing entity-merge endpoint but
      // inlined here so we don't need to fetch a session/cookie for
      // an internal call.
      const newEntityId = String(review.suggestion.newEntityId)
      const candidateId = String(review.suggestion.candidateEntityId)
      await client.query(
        `UPDATE entity_mentions SET entity_id = $1
           WHERE entity_id = $2
             AND NOT EXISTS (SELECT 1 FROM entity_mentions em2
                              WHERE em2.entity_id = $1 AND em2.document_id = entity_mentions.document_id)`,
        [candidateId, newEntityId]
      )
      // Drop dupes after the conditional move.
      await client.query(`DELETE FROM entity_mentions WHERE entity_id = $1`, [newEntityId])
      await client.query(`UPDATE action_items SET person_id = $1 WHERE person_id = $2`, [candidateId, newEntityId])
      await client.query(`UPDATE action_items SET project_id = $1 WHERE project_id = $2`, [candidateId, newEntityId])
      await client.query(
        `UPDATE knowledge_edges SET source_entity_id = $1
           WHERE source_entity_id = $2 AND target_entity_id <> $1`,
        [candidateId, newEntityId]
      )
      await client.query(
        `UPDATE knowledge_edges SET target_entity_id = $1
           WHERE target_entity_id = $2 AND source_entity_id <> $1`,
        [candidateId, newEntityId]
      )
      await client.query(`DELETE FROM knowledge_edges WHERE source_entity_id = $1 OR target_entity_id = $1`, [newEntityId])
      await client.query(`DELETE FROM entities WHERE id = $1`, [newEntityId])
      resolution = { action: 'merged', kept: candidateId, dropped: newEntityId }
    }

    const status = action === 'skip' ? 'dismissed' : 'resolved'
    const updated = await client.query<{
      id: string, status: string, resolution: Record<string, unknown> | null, resolved_at: string
    }>(
      `UPDATE capture_reviews
          SET status = $1, resolution = $2::jsonb, resolved_at = now()
        WHERE id = $3
        RETURNING id, status, resolution, resolved_at::text AS resolved_at`,
      [status, JSON.stringify(resolution), id]
    )
    return { review: updated.rows[0] }
  })
})
