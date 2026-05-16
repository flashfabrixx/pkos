import { getQuery } from 'h3'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const params = getQuery(event)
  const action = typeof params.action === 'string' ? params.action.trim() : ''
  const limit = Math.min(Math.max(Number(params.limit) || 100, 1), 500)
  const offset = Math.max(Number(params.offset) || 0, 0)

  const where: string[] = []
  const values: Array<string | number> = []
  if (action) {
    values.push(action)
    where.push(`action = $${values.length}`)
  }
  values.push(limit)
  const limitIdx = values.length
  values.push(offset)
  const offsetIdx = values.length

  const result = await query(
    `SELECT id, actor, action, resource_kind, resource_id, meta, ip, occurred_at
       FROM audit_events
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY occurred_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    values
  )
  return { events: result.rows, hasMore: result.rows.length === limit }
})
