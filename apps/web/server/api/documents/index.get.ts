import { getQuery } from 'h3'
import { requireAuth } from '../../utils/auth'
import { query } from '../../utils/db'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const params = getQuery(event)
  const limit = clamp(Number(params.limit) || 50, 1, 200)
  const offset = Math.max(Number(params.offset) || 0, 0)

  const result = await query(
    `SELECT id, title, source_type, summary, status, archive_path,
            captured_at::text AS captured_at, created_at, metadata
       FROM documents
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2`,
    [limit, offset]
  )
  return {
    documents: result.rows,
    hasMore: result.rows.length === limit
  }
})

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
