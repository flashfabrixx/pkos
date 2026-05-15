import { getQuery } from 'h3'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const params = getQuery(event)
  const q = typeof params.q === 'string' ? params.q.trim() : ''
  const limit = Math.min(Math.max(Number(params.limit) || 500, 1), 2000)

  const values: Array<string | number> = []
  let whereClause = `e.type = 'tag'`
  if (q) {
    values.push(`%${q}%`)
    whereClause += ` AND e.name ILIKE $${values.length}`
  }
  values.push(limit)

  const result = await query<{
    id: string
    name: string
    document_count: number
    last_seen: string | null
  }>(
    `SELECT e.id, e.name,
       (SELECT COUNT(DISTINCT document_id)::int FROM entity_mentions WHERE entity_id = e.id) AS document_count,
       (SELECT MAX(d.captured_at)::text FROM documents d
          JOIN entity_mentions em ON em.document_id = d.id
          WHERE em.entity_id = e.id) AS last_seen
     FROM entities e
     WHERE ${whereClause}
     ORDER BY e.name
     LIMIT $${values.length}`,
    values
  )
  return { tags: result.rows }
})
