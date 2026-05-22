import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'
import type { SavedViewRow } from '../../utils/saved-views'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const r = await query<SavedViewRow>(
    `SELECT id, name, q, filters,
            created_at::text AS created_at,
            updated_at::text AS updated_at
     FROM saved_views
     WHERE deleted_at IS NULL
     ORDER BY updated_at DESC, created_at DESC`
  )
  return { views: r.rows }
})
