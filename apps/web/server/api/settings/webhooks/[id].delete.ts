import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { recordAudit } from '../../../utils/audit'
import { query } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const actor = requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const result = await query(`DELETE FROM webhook_subscriptions WHERE id = $1 RETURNING id`, [id])
  if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: 'Subscription not found' })
  await recordAudit({ event, actor, action: 'webhook.unsubscribe', resourceKind: 'webhook', resourceId: id })
  return { deleted: true, id }
})
