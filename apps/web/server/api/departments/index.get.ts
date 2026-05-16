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
  let whereClause = `e.type = 'department' AND e.deleted_at IS NULL`
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
    parent_id: string | null
    parent_name: string | null
    members_count: number
    projects_count: number
  }>(
    `SELECT e.id, e.name, e.parent_id,
            (SELECT name FROM entities WHERE id = e.parent_id) AS parent_name,
            (SELECT COUNT(*)::int FROM department_memberships WHERE department_id = e.id AND kind = 'person') AS members_count,
            (SELECT COUNT(*)::int FROM department_memberships WHERE department_id = e.id AND kind = 'project') AS projects_count
       FROM entities e
      WHERE ${whereClause}
      ORDER BY e.name
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    values
  )

  return {
    departments: result.rows,
    hasMore: result.rows.length === limit
  }
})
