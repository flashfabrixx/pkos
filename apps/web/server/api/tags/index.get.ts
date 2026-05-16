import { getQuery } from 'h3'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const params = getQuery(event)
  const q = typeof params.q === 'string' ? params.q.trim() : ''
  const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200)
  const offset = Math.max(Number(params.offset) || 0, 0)

  const values: Array<string | number> = []
  let whereClause = `e.type = 'tag' AND e.deleted_at IS NULL`
  if (q) {
    values.push(`%${q}%`)
    whereClause += ` AND e.name ILIKE $${values.length}`
  }
  values.push(limit)
  const limitIdx = values.length
  values.push(offset)
  const offsetIdx = values.length

  const result = await query<{
    id: string
    name: string
    document_count: number
    last_seen: string | null
  }>(
    `SELECT e.id, e.name,
       (SELECT COUNT(DISTINCT em.document_id)::int FROM entity_mentions em
          JOIN documents d ON d.id = em.document_id
          WHERE em.entity_id = e.id AND d.deleted_at IS NULL) AS document_count,
       (SELECT MAX(d.captured_at)::text FROM documents d
          JOIN entity_mentions em ON em.document_id = d.id
          WHERE em.entity_id = e.id AND d.deleted_at IS NULL) AS last_seen
     FROM entities e
     WHERE ${whereClause}
     ORDER BY e.name
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    values
  )
  return {
    tags: result.rows,
    hasMore: result.rows.length === limit
  }
})
