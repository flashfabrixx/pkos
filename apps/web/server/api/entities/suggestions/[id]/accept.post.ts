import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../../utils/auth'
import { query } from '../../../../utils/db'

/**
 * Accept the suggestion in-place. The UI typically follows up with a
 * call to /api/entities/merge using the same primary + target ids, but
 * accepting on its own marks the row so it's removed from the
 * suggestions list and doesn't get regenerated.
 */
export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const result = await query(
    `UPDATE entity_link_suggestions
       SET accepted_at = now()
     WHERE id = $1 AND accepted_at IS NULL AND dismissed_at IS NULL
     RETURNING id, source_id, target_id`,
    [id]
  )
  if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: 'Suggestion not found' })
  return { accepted: true, suggestion: result.rows[0] }
})
