import { getQuery } from 'h3'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const params = getQuery(event)
  const status = typeof params.status === 'string' ? params.status : 'open'
  const project = typeof params.project === 'string' ? params.project : 'all'
  const allowed = ['open', 'done', 'dismissed']
  const where: string[] = []
  const values: Array<string | number> = []

  if (allowed.includes(status)) {
    values.push(status)
    where.push(`a.status = $${values.length}`)
  }

  if (project !== 'all') {
    values.push(project)
    where.push(`a.project_id = $${values.length}`)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200)
  const offset = Math.max(Number(params.offset) || 0, 0)
  values.push(limit)
  const limitIdx = values.length
  values.push(offset)
  const offsetIdx = values.length

  const result = await query(
    `SELECT
       a.id,
       a.title,
       a.status,
       a.due_date,
       a.document_id,
       a.project_id,
       a.person_id,
       a.created_at,
       d.title AS document_title,
       d.source_type AS document_source_type,
       d.captured_at::text AS document_captured_at,
       p.name AS person_name,
       pr.name AS project_name
     FROM action_items a
     JOIN documents d ON d.id = a.document_id
     LEFT JOIN entities p ON p.id = a.person_id
     LEFT JOIN entities pr ON pr.id = a.project_id
     ${whereSql}
     ORDER BY a.created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    values
  )

  const projects = await query<{ id: string, name: string }>(
    `SELECT DISTINCT pr.id, pr.name
     FROM action_items a
     JOIN entities pr ON pr.id = a.project_id
     WHERE pr.type = 'project'
     ORDER BY pr.name`
  )

  return {
    actions: result.rows,
    projects: projects.rows,
    hasMore: result.rows.length === limit
  }
})
