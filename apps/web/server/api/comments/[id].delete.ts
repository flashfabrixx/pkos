import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const result = await query(`DELETE FROM comments WHERE id = $1`, [id])
  if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: 'Comment not found' })
  return { deleted: true }
})
