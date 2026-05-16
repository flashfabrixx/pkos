import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { recordAudit } from '../../../utils/audit'
import { query } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const actor = requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  // Revocation is a soft op — we keep the row so audit + last_used_at
  // history survives. Hard-delete only via DB if you really need to.
  const result = await query(
    `UPDATE api_keys SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL RETURNING id`,
    [id]
  )
  if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: 'Key not found or already revoked' })
  await recordAudit({ event, actor, action: 'api_key.revoke', resourceKind: 'api_key', resourceId: id })
  return { revoked: true, id }
})
