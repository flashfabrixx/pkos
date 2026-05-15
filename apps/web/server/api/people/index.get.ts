import { getQuery } from 'h3'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const params = getQuery(event)
  const q = typeof params.q === 'string' ? params.q.trim() : ''
  const limit = Math.min(Math.max(Number(params.limit) || 200, 1), 500)

  const values: Array<string | number> = []
  let whereClause = `e.type = 'person'`
  if (q) {
    values.push(`%${q}%`)
    whereClause += ` AND e.name ILIKE $${values.length}`
  }
  values.push(limit)

  const result = await query<{
    id: string
    name: string
    document_count: number
    actions_open: number
    actions_done: number
    last_seen: string | null
  }>(
    `SELECT e.id, e.name,
       (SELECT COUNT(DISTINCT document_id)::int FROM entity_mentions WHERE entity_id = e.id) AS document_count,
       (SELECT COUNT(*)::int FROM action_items WHERE person_id = e.id AND status = 'open') AS actions_open,
       (SELECT COUNT(*)::int FROM action_items WHERE person_id = e.id AND status = 'done') AS actions_done,
       (SELECT MAX(d.captured_at)::text FROM documents d
          JOIN entity_mentions em ON em.document_id = d.id
          WHERE em.entity_id = e.id) AS last_seen
     FROM entities e
     WHERE ${whereClause}
     ORDER BY e.name
     LIMIT $${values.length}`,
    values
  )
  return { people: result.rows }
})
