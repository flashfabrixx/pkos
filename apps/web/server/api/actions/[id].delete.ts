import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const result = await query('DELETE FROM action_items WHERE id = $1 RETURNING id', [id])
  if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: 'Action item not found' })

  return { ok: true }
})
