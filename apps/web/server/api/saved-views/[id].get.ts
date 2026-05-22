import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'
import type { SavedViewRow } from '../../utils/saved-views'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  const r = await query<SavedViewRow>(
    `SELECT id, name, q, filters,
            created_at::text AS created_at,
            updated_at::text AS updated_at
     FROM saved_views
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )
  if (!r.rowCount) throw createError({ statusCode: 404, statusMessage: 'Saved view not found' })
  return { view: r.rows[0] }
})
