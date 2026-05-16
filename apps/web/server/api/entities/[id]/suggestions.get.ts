import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { query } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const result = await query(
    `SELECT s.id, s.target_id, s.score, s.reason, s.created_at,
            e.name AS target_name, e.type AS target_type
       FROM entity_link_suggestions s
       JOIN entities e ON e.id = s.target_id
      WHERE s.source_id = $1
        AND s.accepted_at IS NULL
        AND s.dismissed_at IS NULL
        AND e.deleted_at IS NULL
      ORDER BY s.score DESC
      LIMIT 20`,
    [id]
  )
  return { suggestions: result.rows }
})
