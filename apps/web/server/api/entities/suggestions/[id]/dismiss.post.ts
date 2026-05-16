import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../../utils/auth'
import { query } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const result = await query(
    `UPDATE entity_link_suggestions
       SET dismissed_at = now()
     WHERE id = $1 AND accepted_at IS NULL
     RETURNING id`,
    [id]
  )
  if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: 'Suggestion not found' })
  return { dismissed: true, id }
})
