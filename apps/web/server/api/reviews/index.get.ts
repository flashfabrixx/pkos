import { getQuery } from 'h3'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

interface ReviewRow {
  id: string
  document_id: string
  document_title: string | null
  kind: string
  payload: Record<string, unknown>
  suggestion: Record<string, unknown>
  status: string
  created_at: string
}

/**
 * List open capture reviews. Used by both the sidebar badge (count
 * only, no payload) and the inline wizard on a single capture page.
 *
 * Query params:
 *   - documentId: scope to one capture (wizard mode)
 *   - count: '1' returns {count} only, skips the row payload entirely
 */
export default defineEventHandler(async (event) => {
  requireAuth(event)
  const params = getQuery(event)
  const documentId = typeof params.documentId === 'string' ? params.documentId : null
  const countOnly = params.count === '1'

  if (countOnly) {
    const r = await query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM capture_reviews WHERE status = 'open'`
    )
    return { count: Number(r.rows[0]!.n) }
  }

  const where: string[] = [`r.status = 'open'`]
  const values: string[] = []
  if (documentId) {
    values.push(documentId)
    where.push(`r.document_id = $${values.length}`)
  }

  const result = await query<ReviewRow>(
    `SELECT r.id, r.document_id, d.title AS document_title,
            r.kind, r.payload, r.suggestion, r.status,
            r.created_at::text AS created_at
       FROM capture_reviews r
       LEFT JOIN documents d ON d.id = r.document_id
      WHERE ${where.join(' AND ')}
      ORDER BY r.created_at DESC
      LIMIT 100`,
    values
  )
  return { reviews: result.rows, count: result.rowCount || 0 }
})
