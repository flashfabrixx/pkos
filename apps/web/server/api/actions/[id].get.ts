import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const result = await query(
    `SELECT a.id, a.title, a.description, a.status, a.due_date, a.created_at, a.updated_at,
            a.document_id, a.person_id, a.project_id,
            d.title AS document_title, d.source_type AS document_source_type,
            pe.name AS person_name,
            pr.name AS project_name,
            ae.id AS entity_id
     FROM action_items a
     JOIN documents d ON d.id = a.document_id
     LEFT JOIN entities pe ON pe.id = a.person_id
     LEFT JOIN entities pr ON pr.id = a.project_id
     LEFT JOIN entities ae
       ON ae.type = 'topic'
       AND ae.metadata->>'kind' = 'action_item'
       AND ae.name = a.title
     WHERE a.id = $1 AND a.deleted_at IS NULL`,
    [id]
  )

  const action = result.rows[0]
  if (!action) throw createError({ statusCode: 404, statusMessage: 'Action not found' })

  const comments = action.entity_id
    ? await query(
        `SELECT id, entity_id, body, document_id, created_at, updated_at
         FROM comments
         WHERE entity_id = $1 AND deleted_at IS NULL
         ORDER BY created_at ASC`,
        [action.entity_id]
      )
    : { rows: [] as any[] }

  return { action, comments: comments.rows }
})
