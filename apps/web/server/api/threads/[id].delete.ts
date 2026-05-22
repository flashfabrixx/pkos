import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

/**
 * Soft-delete a thread. Messages are kept (FK cascade only fires on
 * hard delete) so we can resurrect a thread later if needed; the
 * listing query filters by deleted_at IS NULL.
 */
export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const result = await query(
    `UPDATE conversation_threads
       SET deleted_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )
  if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: 'Thread not found' })
  return { deleted: true }
})
