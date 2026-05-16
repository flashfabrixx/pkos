import { requireAuth } from '../../../utils/auth'
import { query } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const result = await query(
    `SELECT id, name, prefix, scopes, actor, last_used_at, created_at, revoked_at
       FROM api_keys
      ORDER BY created_at DESC`
  )
  return { keys: result.rows }
})
