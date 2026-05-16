import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const [documents, entities, actions, comments] = await Promise.all([
    query(
      `SELECT id, title, source_type, summary, status,
              captured_at::text AS captured_at, created_at, deleted_at
         FROM documents
        WHERE deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
        LIMIT 200`
    ),
    query(
      `SELECT id, type, name, deleted_at
         FROM entities
        WHERE deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
        LIMIT 200`
    ),
    query(
      `SELECT a.id, a.title, a.status, a.due_date, a.created_at, a.deleted_at,
              a.document_id, d.title AS document_title
         FROM action_items a
         LEFT JOIN documents d ON d.id = a.document_id
        WHERE a.deleted_at IS NOT NULL
        ORDER BY a.deleted_at DESC
        LIMIT 200`
    ),
    query(
      `SELECT c.id, c.entity_id, c.body, c.document_id, c.created_at, c.deleted_at,
              e.name AS entity_name, e.type AS entity_type
         FROM comments c
         LEFT JOIN entities e ON e.id = c.entity_id
        WHERE c.deleted_at IS NOT NULL
        ORDER BY c.deleted_at DESC
        LIMIT 200`
    )
  ])

  return {
    documents: documents.rows,
    entities: entities.rows,
    actions: actions.rows,
    comments: comments.rows
  }
})
