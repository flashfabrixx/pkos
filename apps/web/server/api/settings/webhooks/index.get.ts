import { requireAuth } from '../../../utils/auth'
import { query } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const subs = await query(
    `SELECT id, url, events, active, last_status, last_delivered_at, created_at
       FROM webhook_subscriptions
      ORDER BY created_at DESC`
  )
  return { subscriptions: subs.rows }
})
